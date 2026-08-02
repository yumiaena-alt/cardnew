import * as z from 'zod';
import { layerSchema } from './layers';
import type { Layer } from './layers';
import {
  aspectRatioSchema,
  CANVAS_BASE,
  canvasSize,
  paintSchema,
  safeAreaSchema,
} from './primitives';
import type { AspectRatio } from './primitives';

/**
 * SlideDoc — 시스템의 중심 자료구조.
 *
 * 이 하나의 스키마가 다음 전부를 담당한다:
 *   ① 에디터 상태  ② 서버 렌더 입력  ③ AI 편집(EditOp) 대상
 *   ④ 템플릿 정의  ⑤ 비율 변형 소스  ⑥ 브랜드 학습 스냅샷
 *
 * 따라서 v(버전)를 항상 함께 저장한다. 렌더러는 자신이 아는 버전만 처리하고,
 * 낮은 버전은 마이그레이션을 거친다(migrate.ts).
 */

export const SLIDEDOC_VERSION = 3 as const;

export const slideRoleSchema = z.enum(['cover', 'problem', 'point', 'example', 'quote', 'cta']);

export type SlideRole = z.infer<typeof slideRoleSchema>;

export const slideDocMetaSchema = z.object({
  templateId: z.string().default('blank'),
  brandKitId: z.string().nullable().default(null),
  /** 조판 엔진이 대비 4.5:1을 검증했는지. false면 발행 전 재검증한다. */
  contrastChecked: z.boolean().default(false),
  /** 조판 엔진이 autoFit을 적용해 확정한 상태인지 */
  fitted: z.boolean().default(false),
});

export const slideDocSchema = z.object({
  v: z.literal(SLIDEDOC_VERSION),
  canvas: z.object({
    ratio: aspectRatioSchema,
    /** 논리 캔버스 단변 픽셀. 렌더 시 scale로 배수 조정. */
    base: z.number().int().positive().default(CANVAS_BASE),
    bg: paintSchema.default({ kind: 'solid', color: '#FFFFFF' }),
  }),
  safeArea: safeAreaSchema.prefault({}),
  /** 뒤 → 앞 순서. z 값이 아니라 배열 순서가 렌더 순서의 진실이다. */
  layers: z.array(layerSchema).default([]),
  role: slideRoleSchema.optional(),
  meta: slideDocMetaSchema.prefault({}),
});

export type SlideDoc = z.infer<typeof slideDocSchema>;

/** 파싱 + 기본값 채우기. 잘못된 문서는 여기서 걸러진다. */
export function parseSlideDoc(input: unknown): SlideDoc {
  return slideDocSchema.parse(input);
}

export function safeParseSlideDoc(input: unknown) {
  return slideDocSchema.safeParse(input);
}

/** 빈 슬라이드. 테스트와 "새 슬라이드 추가"의 시작점. */
export function createEmptySlideDoc(ratio: AspectRatio = '4:5'): SlideDoc {
  return slideDocSchema.parse({
    v: SLIDEDOC_VERSION,
    canvas: { ratio },
    layers: [],
  });
}

/** 문서의 논리 캔버스 픽셀 크기. */
export function docCanvasSize(doc: SlideDoc): { width: number; height: number } {
  return canvasSize(doc.canvas.ratio, doc.canvas.base);
}

export function findLayer(doc: SlideDoc, layerId: string): Layer | undefined {
  return doc.layers.find((l) => l.id === layerId);
}

export function layerIndex(doc: SlideDoc, layerId: string): number {
  return doc.layers.findIndex((l) => l.id === layerId);
}

/**
 * LLM/AI 디자이너에게 넘길 압축 요약.
 *
 * 전체 SlideDoc은 수십 KB라 그대로 프롬프트에 넣으면 토큰이 폭증하고
 * 모델이 무관한 필드를 건드린다. 편집 판단에 필요한 최소 정보만 노출한다.
 */
export function summarizeForLLM(doc: SlideDoc) {
  return {
    ratio: doc.canvas.ratio,
    role: doc.role ?? null,
    layers: doc.layers.map((l) => {
      const base = {
        id: l.id,
        type: l.type,
        role: l.role,
        anchor: l.layout.anchor,
        hidden: l.hidden,
      };
      if (l.type === 'text') {
        return {
          ...base,
          text: l.text,
          fontSize: l.style.size,
          weight: l.style.weight,
          color: l.style.color,
          align: l.style.align,
        };
      }
      if (l.type === 'image') {
        return {
          ...base,
          hasOverlay: Boolean(l.overlay),
          focus: l.focus,
          fit: l.fit,
        };
      }
      return base;
    }),
  };
}

/** 사람이 읽을 수 있는 요약 (감사 로그·학습 스냅샷용) */
export function digestSlideDoc(doc: SlideDoc) {
  return {
    templateId: doc.meta.templateId,
    ratio: doc.canvas.ratio,
    layerCount: doc.layers.length,
    texts: doc.layers
      .filter((l) => l.type === 'text')
      .map((l) => ({ role: l.role, text: (l as { text: string }).text })),
  };
}
