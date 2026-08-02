import type { SlideDoc } from '@/lib/slidedoc/doc';
import { docCanvasSize } from '@/lib/slidedoc/doc';
import type { Rect } from '@/lib/slidedoc/geometry';
import { fontScale, resolveRect } from '@/lib/slidedoc/geometry';
import { approxMeasureFn, fitTextSize } from './autofit';
import type { MeasureFn } from './autofit';

/**
 * 조판(typeset) — autoFit을 실제로 적용해 레이어별 폰트 크기를 확정한다.
 *
 * 이 단계가 없으면 텍스트가 선언된 size 그대로 렌더되어 캔버스를 넘친다.
 * LLM이 카피 길이를 예측할 수 없으니(같은 프롬프트에도 매번 다르다)
 * 크기 결정은 반드시 결정론적 코드가 해야 한다.
 *
 * 측정 함수는 주입한다:
 *  - 서버 사전 조판: approxMeasureFn (근사, 빠름)
 *  - 브라우저 정밀 조판: DOM 실측 함수 (정확)
 * Phase 1에서 렌더 서비스가 Playwright 안에서 실측 조판을 하도록 확장한다.
 */

export type TypesetResult = {
  /** 레이어 id → 확정된 폰트 크기(base 캔버스 기준 px) */
  fittedSizes: Record<string, number>;
  /** 최소 크기로도 안 들어간 레이어. 호출부가 카피 축약을 요청해야 한다. */
  overflows: { layerId: string; role: string; text: string }[];
  /**
   * 서로 겹치는 텍스트 레이어 쌍.
   *
   * 하단 앵커 레이어는 텍스트가 길어지면 위로 자라서 상단 레이어를 침범할 수 있다.
   * 절대 앵커만으로는 이걸 구조적으로 막을 수 없으므로(Phase 1 템플릿 시스템에서
   * 스택/플로우 개념을 도입한다), 최소한 **감지해서 보고**한다.
   * 골든셋 품질 회귀 검사가 이 신호를 쓴다.
   */
  collisions: { a: string; b: string; overlapRatio: number }[];
  /** 레이어별 확정 사각형(논리 캔버스 px). 안전영역 검증·디버깅용. */
  rects: Record<string, Rect>;
};

export type TypesetOptions = {
  /** 커스텀 측정 함수. 없으면 근사 측정을 쓴다. */
  measure?: MeasureFn;
  /**
   * h가 없는 텍스트의 높이 상한(캔버스 높이 대비 비율).
   * 자동 높이 텍스트는 원래 무제한으로 자라므로, 캔버스를 넘지 않도록 상한을 둔다.
   */
  autoHeightLimit?: number;
};

export function typesetSlide(doc: SlideDoc, options: TypesetOptions = {}): TypesetResult {
  const canvas = docCanvasSize(doc);
  // 조판은 논리 캔버스(base) 기준으로 한다. 렌더 배수는 나중에 곱하므로
  // 여기서 스케일을 섞으면 배수마다 다른 폰트 크기가 나와 결과가 달라진다.
  const scale = fontScale(canvas, doc.canvas.base);
  const autoHeightLimit = options.autoHeightLimit ?? 0.7;

  const fittedSizes: Record<string, number> = {};
  const overflows: TypesetResult['overflows'] = [];
  const rects: Record<string, Rect> = {};

  for (const layer of doc.layers) {
    if (layer.type !== 'text' || layer.hidden) {
      continue;
    }
    const text = layer;

    const measure = options.measure ?? approxMeasureFn(text.style.lineHeight);

    // 논리 좌표계로 환산: CSS는 base 기준 px을 쓰고 렌더 시 scale이 곱해진다.
    const availableWidth = (text.layout.w * canvas.width) / scale;
    const availableHeight =
      text.layout.h !== undefined
        ? (text.layout.h * canvas.height) / scale
        : (autoHeightLimit * canvas.height) / scale;

    let finalSize = text.style.size;

    if (text.style.autoFit.enabled) {
      const result = fitTextSize(
        text.text,
        {
          maxWidth: availableWidth,
          maxHeight: availableHeight,
          maxLines: text.style.autoFit.maxLines,
          minSize: text.style.autoFit.min,
          maxSize: text.style.autoFit.max,
          lineHeight: text.style.lineHeight,
        },
        measure,
      );
      finalSize = result.fontSize;
      fittedSizes[layer.id] = result.fontSize;
      if (result.overflow) {
        overflows.push({ layerId: layer.id, role: text.role, text: text.text });
      }
    }

    // autoFit이 꺼진 레이어도 충돌 검사 대상이므로 사각형은 항상 계산한다.
    const metrics = measure(text.text, finalSize, availableWidth);
    rects[layer.id] = resolveRect(text.layout, canvas, metrics.height * scale);
  }

  return { fittedSizes, overflows, collisions: detectCollisions(rects), rects };
}

/**
 * 텍스트 레이어 간 겹침 감지.
 *
 * 완전히 겹치는 경우만 잡으면 "살짝 물린" 케이스를 놓치고,
 * 1px만 닿아도 보고하면 노이즈가 된다. 작은 쪽 면적의 8% 이상 겹칠 때만 보고한다.
 */
const COLLISION_THRESHOLD = 0.08;

export function detectCollisions(rects: Record<string, Rect>): TypesetResult['collisions'] {
  const entries = Object.entries(rects);
  const collisions: TypesetResult['collisions'] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [idA, a] = entries[i]!;
      const [idB, b] = entries[j]!;

      const overlapW = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
      const overlapH = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
      if (overlapW <= 0 || overlapH <= 0) {
        continue;
      }

      const overlapArea = overlapW * overlapH;
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (smaller <= 0) {
        continue;
      }

      const ratio = overlapArea / smaller;
      if (ratio >= COLLISION_THRESHOLD) {
        collisions.push({ a: idA, b: idB, overlapRatio: Math.round(ratio * 100) / 100 });
      }
    }
  }

  return collisions;
}

/**
 * 조판 결과를 문서에 굽는다(bake).
 *
 * fittedSizes를 렌더 시점에 전달하는 대신 문서에 반영하고 싶을 때 쓴다.
 * 사용자가 에디터에서 크기를 직접 만지면 autoFit을 끄는 것이 자연스러우므로,
 * bake는 autoFit.enabled를 false로 내리고 확정 크기를 style.size에 적는다.
 */
export function bakeTypeset(doc: SlideDoc, result: TypesetResult): SlideDoc {
  const layers = doc.layers.map((layer) => {
    if (layer.type !== 'text') {
      return layer;
    }
    const fitted = result.fittedSizes[layer.id];
    if (fitted === undefined) {
      return layer;
    }
    return {
      ...layer,
      style: { ...layer.style, size: fitted },
    };
  });

  return { ...doc, layers, meta: { ...doc.meta, fitted: true } };
}
