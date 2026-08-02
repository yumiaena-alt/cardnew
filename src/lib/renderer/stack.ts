import { fontScale } from '@/lib/slidedoc/geometry';
import type { Layer } from '@/lib/slidedoc/layers';
import { approxMeasureFn, fitTextSize } from './autofit';

/**
 * 수직 스택 해석 (flow layout).
 *
 * 문제: 템플릿이 각 텍스트의 y 오프셋을 고정 비율로 주면, 캔버스가 짧을 때(1:1, 16:9)
 * 텍스트가 캔버스 높이의 더 큰 비율을 차지해 위쪽 레이어를 침범한다.
 * 폰트 크기는 px 기준인데 오프셋은 높이 비율이라 둘의 단위가 어긋나기 때문이다.
 *
 * 해결: 템플릿은 "무엇을 어떤 순서로 쌓을지"만 선언하고,
 * 실제 y 값은 여기서 **텍스트 높이를 측정한 뒤** 계산한다.
 * 고정 숫자를 조정하는 방식은 비율 하나를 고치면 다른 비율이 깨지는 순환에 빠진다.
 */

export type StackSpec = {
  /**
   * bottom: 아래에서 위로 쌓는다 (order 앞이 가장 아래).
   * top:    위에서 아래로 쌓는다 (order 앞이 가장 위).
   * middle: 전체 높이를 재서 세로 중앙에 배치한다 (order 앞이 가장 위).
   */
  from: 'bottom' | 'top' | 'middle';
  order: string[];
  /** 첫 레이어의 시작 오프셋 (캔버스 높이 대비 비율). from='middle'에서는 무시된다. */
  start: number;
  /** 레이어 사이 간격 (캔버스 높이 대비 비율) */
  gap: number;
};

export type ResolveStackResult = {
  layers: Layer[];
  /** 스택 전체가 차지한 높이 (캔버스 높이 대비 비율). 카드 높이 계산 등에 쓴다. */
  totalHeight: number;
};

/**
 * 스택에 속한 레이어들의 y를 실측 높이로 다시 계산한다.
 *
 * 스택에 없는 레이어는 그대로 통과시킨다 — 배경, 도형, 중앙 정렬 텍스트 등.
 */
export function resolveStack(
  layers: Layer[],
  stack: StackSpec,
  canvas: { width: number; height: number },
  base: number,
): ResolveStackResult {
  const scale = fontScale(canvas, base);
  const byId = new Map(layers.map((l) => [l.id, l]));

  // 높이를 먼저 전부 측정한다. middle은 총 높이를 알아야 시작점을 정할 수 있다.
  const heights = stack.order.map((layerId) => {
    const layer = byId.get(layerId);
    return layer ? measureLayerHeightRatio(layer, canvas, scale) : null;
  });

  const presentCount = heights.filter((h): h is number => h !== null).length;
  const totalHeight =
    heights.reduce<number>((sum, h) => sum + (h ?? 0), 0) +
    Math.max(0, presentCount - 1) * stack.gap;

  // middle은 중앙 정렬을 위해 상단 오프셋으로 변환한다.
  const start = stack.from === 'middle' ? Math.max(0, (1 - totalHeight) / 2) : stack.start;
  // middle/top은 위에서 아래로 진행하므로 앵커의 세로 성분을 top으로 바꾼다.
  const convertToTop = stack.from === 'middle';

  let cursor = start;
  const updates = new Map<string, number>();

  for (const [position, layerId] of stack.order.entries()) {
    const height = heights[position];
    if (height === null || height === undefined) {
      continue;
    }

    updates.set(layerId, cursor);
    cursor += height;
    // 마지막 요소 뒤에는 간격을 넣지 않는다.
    if (position < stack.order.length - 1) {
      cursor += stack.gap;
    }
  }

  const resolved = layers.map((layer) => {
    const y = updates.get(layer.id);
    if (y === undefined) {
      return layer;
    }

    const anchor = convertToTop ? toTopAnchor(layer.layout.anchor) : layer.layout.anchor;
    return { ...layer, layout: { ...layer.layout, anchor, y } };
  });

  return { layers: resolved, totalHeight };
}

/** 앵커의 가로 성분은 유지하고 세로 성분만 top으로 바꾼다. */
function toTopAnchor(anchor: Layer['layout']['anchor']): Layer['layout']['anchor'] {
  if (anchor.endsWith('-right')) {
    return 'top-right';
  }
  if (anchor === 'center' || anchor.endsWith('-center')) {
    return 'top-center';
  }
  return 'top-left';
}

/**
 * 레이어 높이를 캔버스 높이 대비 비율로 측정한다.
 *
 * 텍스트는 autoFit 결과 폰트 크기로 줄 수를 세어 높이를 구한다.
 * 여기서 autoFit을 한 번 돌리는 비용이 아깝지만, 측정 없이 추정하면
 * 애초에 이 모듈을 만든 이유가 없어진다. 조판 전체가 순수 계산이라 충분히 빠르다.
 */
function measureLayerHeightRatio(
  layer: Layer,
  canvas: { width: number; height: number },
  scale: number,
): number {
  if (layer.layout.h !== undefined) {
    return layer.layout.h;
  }

  if (layer.type !== 'text') {
    // 높이를 모르는 비텍스트 레이어는 0으로 둔다. 도형은 h를 명시하게 되어 있다.
    return 0;
  }

  const text = layer;
  const availableWidth = (text.layout.w * canvas.width) / scale;
  const measure = approxMeasureFn(text.style.lineHeight);

  const size = text.style.autoFit.enabled
    ? fitTextSize(
        text.text,
        {
          maxWidth: availableWidth,
          maxLines: text.style.autoFit.maxLines,
          minSize: text.style.autoFit.min,
          maxSize: text.style.autoFit.max,
          lineHeight: text.style.lineHeight,
        },
        measure,
      ).fontSize
    : text.style.size;

  const metrics = measure(text.text, size, availableWidth);
  // 논리 px → 실제 px → 캔버스 높이 비율
  return (metrics.height * scale) / canvas.height;
}

/** 스택에 실제로 존재하는 레이어 id만 남긴다 (선택 요소가 없을 수 있다). */
export function presentIds(layers: Layer[], candidateIds: (string | null)[]): string[] {
  const present = new Set(layers.map((l) => l.id));
  return candidateIds.filter((id): id is string => id !== null && present.has(id));
}
