import * as z from 'zod';

/**
 * SlideDoc 기본 단위.
 *
 * 좌표계 원칙: 모든 위치·크기는 캔버스 대비 0~1 비율이다.
 * 절대 픽셀을 저장하면 비율 리사이즈(9:16 → 1:1)에서 레이아웃이 깨진다.
 * 폰트 크기만 예외로 base(1080px) 기준 px을 쓰되, 렌더 시 스케일을 곱한다.
 */

export const CANVAS_BASE = 1080;

/** 지원 비율. 값은 width/height. */
export const ASPECT_RATIOS = {
  '1:1': 1 / 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '3:4': 3 / 4,
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIOS;

export const aspectRatioSchema = z.enum(['1:1', '4:5', '9:16', '16:9', '3:4']);

/** 비율 문자열 → 캔버스 픽셀 크기. 짧은 변을 CANVAS_BASE에 맞춘다. */
export function canvasSize(
  ratio: AspectRatio,
  base = CANVAS_BASE,
): { width: number; height: number } {
  const r = ASPECT_RATIOS[ratio];
  return r >= 1
    ? { width: Math.round(base * r), height: base }
    : { width: base, height: Math.round(base / r) };
}

/** 0~1 정규화 비율. */
export const ratioSchema = z.number().min(0).max(1);

/** 캔버스를 벗어나는 배치도 허용해야 하므로 위치는 범위를 넓게 둔다. */
export const looseRatioSchema = z.number().min(-2).max(3);

export const hexColorSchema = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u,
    'hex 색상이어야 합니다 (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)',
  );

/** CSS로 그대로 내보낼 수 있는 색 표현. hex 또는 rgba()/oklch() 등 함수 표기 허용. */
export const cssColorSchema = z.union([
  hexColorSchema,
  z.string().regex(/^(?:rgba?|hsla?|oklch|oklab|color-mix)\(/u, 'CSS 색상 함수 표기여야 합니다'),
  z.literal('transparent'),
  z.literal('currentColor'),
]);

export const gradientStopSchema = z.object({
  /** 0~1 위치 */
  at: ratioSchema,
  color: cssColorSchema,
});

export const gradientSchema = z.object({
  type: z.enum(['linear', 'radial']),
  /** linear일 때 각도(deg). 180 = 위→아래 */
  angle: z.number().min(-360).max(360).default(180),
  stops: z.array(gradientStopSchema).min(2),
});

export const paintSchema = z.union([
  z.object({ kind: z.literal('solid'), color: cssColorSchema }),
  z
    .object({ kind: z.literal('gradient') })
    .and(gradientSchema.omit({ type: true }).extend({ type: z.enum(['linear', 'radial']) })),
  z.object({ kind: z.literal('none') }),
]);

export const anchorSchema = z.enum([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);

export type Anchor = z.infer<typeof anchorSchema>;

/**
 * 제약 기반 레이아웃 박스.
 *
 * anchor를 기준점으로 삼고, x/y는 그 기준점에서의 오프셋(캔버스 비율)이다.
 * 예) anchor='bottom-center', y=0.08 → 아래에서 8% 띄운 가운데 정렬.
 * 이렇게 두면 캔버스 비율이 바뀌어도 "아래에서 8%"라는 의도가 보존된다.
 */
export const layoutBoxSchema = z.object({
  anchor: anchorSchema.default('top-left'),
  x: looseRatioSchema.default(0),
  y: looseRatioSchema.default(0),
  /** 캔버스 폭 대비 너비 */
  w: z.number().min(0).max(3).default(1),
  /** 생략 시 콘텐츠 높이에 맞춤 */
  h: z.number().min(0).max(3).optional(),
  rotate: z.number().min(-360).max(360).default(0),
  z: z.number().int().default(0),
});

export type LayoutBox = z.infer<typeof layoutBoxSchema>;

/** 안전 영역: 플랫폼 UI(프로필·버튼)에 가려지는 여백 비율. */
export const safeAreaSchema = z.object({
  top: ratioSchema.default(0.06),
  right: ratioSchema.default(0.06),
  bottom: ratioSchema.default(0.06),
  left: ratioSchema.default(0.06),
});

export type SafeArea = z.infer<typeof safeAreaSchema>;
