import * as z from 'zod';
import {
  cssColorSchema,
  gradientSchema,
  layoutBoxSchema,
  paintSchema,
  ratioSchema,
} from './primitives';

/**
 * 레이어 스키마.
 *
 * 설계 원칙: 레이어에 role을 명시한다.
 * role이 있으면 ① 템플릿 슬롯 매핑 ② AI 편집 명령의 대상 지정
 * ③ 비율 리사이즈 시 우선순위 판단 ④ 브랜드 학습 집계가 모두 가능해진다.
 * role 없이 id만으로는 "제목을 크게" 같은 지시를 해석할 수 없다.
 */

const layerBaseSchema = z.object({
  id: z.string().min(1),
  // 모든 하위 필드에 기본값이 있으므로 layout 자체도 생략 가능해야 한다.
  // 이게 없으면 최소 입력({id, type, role})으로 레이어를 만들 수 없다.
  layout: layoutBoxSchema.prefault({}),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  opacity: ratioSchema.default(1),
});

// ─── 텍스트 ──────────────────────────────────────────────────

export const textRoleSchema = z.enum([
  'headline',
  'subhead',
  'body',
  'caption',
  'badge',
  'eyebrow',
  'pagenum',
]);

export const fontWeightSchema = z.union([
  z.literal(100),
  z.literal(200),
  z.literal(300),
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
  z.literal(900),
]);

/**
 * 자동 맞춤 설정.
 * 조판 엔진이 min~max 사이에서 이진탐색으로 폰트 크기를 정해
 * 텍스트가 박스 안에 maxLines 이하로 정확히 수납되게 만든다.
 */
export const autoFitSchema = z.object({
  enabled: z.boolean().default(true),
  min: z.number().positive().default(28),
  max: z.number().positive().default(120),
  maxLines: z.number().int().positive().default(4),
});

export const textShadowSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(2),
  blur: z.number().min(0).default(8),
  color: cssColorSchema.default('#00000059'),
});

export const textStyleSchema = z.object({
  family: z.string().min(1).default('Pretendard'),
  weight: fontWeightSchema.default(700),
  /** base(1080px) 캔버스 기준 px. 렌더 시 스케일 배수를 곱한다. */
  size: z.number().positive().default(64),
  autoFit: autoFitSchema.prefault({}),
  color: cssColorSchema.default('#FFFFFF'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  /** 배수 (1.3 = 130%) */
  lineHeight: z.number().positive().default(1.3),
  /** em 단위 (-0.02 = -2%) */
  letterSpacing: z.number().default(-0.02),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  strike: z.boolean().default(false),
  transform: z.enum(['none', 'upper', 'lower']).default('none'),
  shadow: textShadowSchema.optional(),
  highlight: z
    .object({
      color: cssColorSchema,
      style: z.enum(['box', 'underline', 'marker']),
    })
    .optional(),
});

export type TextStyle = z.infer<typeof textStyleSchema>;

export const textLayerSchema = layerBaseSchema.extend({
  type: z.literal('text'),
  role: textRoleSchema,
  text: z.string().default(''),
  style: textStyleSchema.prefault({}),
});

export type TextLayer = z.infer<typeof textLayerSchema>;

// ─── 이미지 ──────────────────────────────────────────────────

export const imageFilterSchema = z.object({
  brightness: z.number().min(0).max(3).default(1),
  contrast: z.number().min(0).max(3).default(1),
  saturate: z.number().min(0).max(3).default(1),
  blur: z.number().min(0).max(64).default(0),
  grayscale: ratioSchema.default(0),
});

export const imageLayerSchema = layerBaseSchema.extend({
  type: z.literal('image'),
  role: z.enum(['background', 'inline', 'sticker']),
  /** image_assets.id. provenance 추적의 연결점 — 렌더에는 src를 쓴다. */
  assetId: z.string().nullable().default(null),
  src: z.string().default(''),
  /** CSS object-position 대응. 0.5/0.5 = 중앙. 에디터의 초점 크로스헤어가 이 값을 쓴다. */
  focus: z.object({ x: ratioSchema, y: ratioSchema }).default({ x: 0.5, y: 0.5 }),
  fit: z.enum(['cover', 'contain']).default('cover'),
  scale: z.number().min(0.1).max(5).default(1),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  radius: z.number().min(0).default(0),
  filter: imageFilterSchema.prefault({}),
  /**
   * 가독성 오버레이. 조판 엔진이 배경 휘도를 실측해 자동 결정한다(차별점 #2).
   * 사용자가 손대면 manualOverlay=true가 되어 자동 조정이 멈춘다.
   */
  overlay: gradientSchema.optional(),
  manualOverlay: z.boolean().default(false),
});

export type ImageLayer = z.infer<typeof imageLayerSchema>;

// ─── 도형 ────────────────────────────────────────────────────

export const shapeLayerSchema = layerBaseSchema.extend({
  type: z.literal('shape'),
  role: z.enum(['divider', 'accent', 'scrim', 'frame']),
  shape: z.enum(['rect', 'ellipse', 'line']).default('rect'),
  fill: paintSchema.default({ kind: 'solid', color: '#000000' }),
  stroke: z.object({ color: cssColorSchema, width: z.number().positive() }).optional(),
  radius: z.number().min(0).default(0),
});

export type ShapeLayer = z.infer<typeof shapeLayerSchema>;

// ─── 로고 ────────────────────────────────────────────────────

export const logoLayerSchema = layerBaseSchema.extend({
  type: z.literal('logo'),
  role: z.literal('logo'),
  /** brand_assets.id */
  assetId: z.string().nullable().default(null),
  src: z.string().default(''),
  /** 어두운 배경용 흰색 변형 등 */
  variant: z.enum(['default', 'light', 'dark', 'mono']).default('default'),
});

export type LogoLayer = z.infer<typeof logoLayerSchema>;

// ─── 영상 (Phase 4 예약) ─────────────────────────────────────

export const videoLayerSchema = layerBaseSchema.extend({
  type: z.literal('video'),
  role: z.enum(['background', 'inline']),
  assetId: z.string().nullable().default(null),
  src: z.string().default(''),
  posterSrc: z.string().default(''),
  trim: z.object({ startSec: z.number().min(0), endSec: z.number().min(0) }).optional(),
  muted: z.boolean().default(true),
  fit: z.enum(['cover', 'contain']).default('cover'),
});

export type VideoLayer = z.infer<typeof videoLayerSchema>;

// ─── 합집합 ──────────────────────────────────────────────────

export const layerSchema = z.discriminatedUnion('type', [
  textLayerSchema,
  imageLayerSchema,
  shapeLayerSchema,
  logoLayerSchema,
  videoLayerSchema,
]);

export type Layer = z.infer<typeof layerSchema>;
export type LayerType = Layer['type'];

export function isTextLayer(layer: Layer): layer is TextLayer {
  return layer.type === 'text';
}

export function isImageLayer(layer: Layer): layer is ImageLayer {
  return layer.type === 'image';
}

/** 배경 이미지 레이어(가독성 분석 대상)를 찾는다. */
export function findBackgroundImage(layers: Layer[]): ImageLayer | undefined {
  return layers.find((l): l is ImageLayer => l.type === 'image' && l.role === 'background');
}
