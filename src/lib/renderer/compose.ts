import type { CardnewsPlan, SlidePlan } from '@/lib/plan/schema';
import { SLIDEDOC_VERSION, parseSlideDoc } from '@/lib/slidedoc/doc';
import type { SlideDoc } from '@/lib/slidedoc/doc';
import type { Layer } from '@/lib/slidedoc/layers';
import { CANVAS_BASE, canvasSize } from '@/lib/slidedoc/primitives';
import type { AspectRatio } from '@/lib/slidedoc/primitives';
import type { PanelLayoutSpec } from '@/models/Template';
import { learnedTemplates } from './learned';
import { selectTemplate } from './registry';
import { resolveStack } from './stack';
import { DEFAULT_BRAND_STYLE, estimateLumaFromMood } from './types';
import type { BrandStyle, BuildResult, ResolvedImage, Template } from './types';
import { typesetSlide } from './typeset';
import type { TypesetResult } from './typeset';

/**
 * 조판 엔진 (Stage 3).
 *
 * 기획(SlidePlan) + 템플릿 + 브랜드킷 + 이미지 → SlideDoc.
 *
 * 이 단계에 LLM이 개입하지 않는다. 전부 결정론적이므로:
 *  - 같은 입력에 같은 결과 → 재현·디버깅 가능
 *  - 0크레딧·0지연
 *  - 텍스트 넘침·대비 미달·레이어 겹침을 코드로 보장
 */

export type ComposeSlideOptions = {
  plan: SlidePlan;
  ratio: AspectRatio;
  /** 슬라이드 순번 (0-based) */
  index: number;
  totalSlides: number;
  brand?: BrandStyle;
  /** 조달된 배경 이미지. null이면 단색 배경 템플릿을 쓴다. */
  image?: ResolvedImage | null;
  /** 브랜드킷의 템플릿 채택률 가중치 */
  templateWeights?: Record<string, number>;
  /** Layouts read off reference designs. Used in place of the built-in set. */
  learnedLayouts?: PanelLayoutSpec[];
  /** 템플릿 선택을 결정론적으로 만드는 시드 (보통 contentId) */
  seed: string;
  /** 페이지 번호 표시 여부 */
  showPageNumber?: boolean;
  /** 강제로 특정 템플릿을 쓴다 (미리보기·테스트용) */
  forceTemplateId?: string;
  brandKitId?: string | null;
};

export type ComposedSlide = {
  doc: SlideDoc;
  templateId: string;
  typeset: TypesetResult;
  /** 조판 품질 문제. 비어 있지 않으면 카피 축약이나 템플릿 교체가 필요하다. */
  warnings: ComposeWarning[];
};

export type ComposeWarning =
  | { kind: 'overflow'; layerId: string; role: string }
  | { kind: 'collision'; a: string; b: string; overlapRatio: number };

/** 슬라이드 한 장을 조판한다. */
export function composeSlide(options: ComposeSlideOptions): ComposedSlide {
  const {
    plan,
    ratio,
    index,
    totalSlides,
    brand = DEFAULT_BRAND_STYLE,
    image = null,
    templateWeights,
    learnedLayouts,
    seed,
    showPageNumber = true,
    forceTemplateId,
  } = options;

  const canvas = canvasSize(ratio);

  const template = resolveTemplate({
    forceTemplateId,
    role: plan.role,
    hasImage: image !== null,
    hint: plan.templateHint,
    weights: templateWeights,
    ...(learnedLayouts ? { learned: learnedTemplates(learnedLayouts) } : {}),
    // 슬라이드마다 다른 템플릿이 나오도록 index를 시드에 섞는다.
    seed: `${seed}:${index}`,
  });

  const built = template.build({
    plan,
    ratio,
    canvas,
    brand,
    image,
    pageLabel: showPageNumber ? `${index + 1} / ${totalSlides}` : null,
  });

  const layers = applyStackAndBackdrop(built, canvas);

  const doc = parseSlideDoc({
    v: SLIDEDOC_VERSION,
    canvas: { ratio, bg: built.background },
    role: plan.role,
    ...(built.safeArea ? { safeArea: built.safeArea } : {}),
    layers,
    meta: {
      templateId: template.id,
      brandKitId: options.brandKitId ?? null,
      // 아래 typeset에서 대비·맞춤을 확정하므로 그 결과로 갱신한다.
      contrastChecked: true,
      fitted: false,
    },
  });

  const typeset = typesetSlide(doc);

  const warnings: ComposeWarning[] = [
    ...typeset.overflows.map(
      (o): ComposeWarning => ({ kind: 'overflow', layerId: o.layerId, role: o.role }),
    ),
    ...typeset.collisions.map(
      (c): ComposeWarning => ({
        kind: 'collision',
        a: c.a,
        b: c.b,
        overlapRatio: c.overlapRatio,
      }),
    ),
  ];

  return { doc, templateId: template.id, typeset, warnings };
}

/**
 * 스택과 배경 판을 해석한다.
 *
 * 순서가 중요하다: 스택을 먼저 풀어 높이를 구하고, 그 높이로 카드를 만든 뒤
 * 카드를 레이어 배열의 **맨 앞**(가장 뒤에 그려지는 위치)에 넣는다.
 * 카드를 나중에 추가하면 텍스트를 덮어버린다.
 */
function applyStackAndBackdrop(
  built: BuildResult,
  canvas: { width: number; height: number },
): Layer[] {
  if (!built.stack) {
    return built.layers;
  }

  const resolved = resolveStack(built.layers, built.stack, canvas, CANVAS_BASE);
  if (!built.backdrop) {
    return resolved.layers;
  }

  const spec = built.backdrop;
  const card: Layer = {
    id: spec.id,
    type: 'shape',
    role: 'scrim',
    shape: 'rect',
    fill: { kind: 'solid', color: spec.color },
    radius: spec.radius,
    layout: {
      anchor: 'bottom-left',
      x: spec.x,
      y: spec.bottom,
      w: spec.w,
      // 스택 높이 + 위아래 여백
      h: resolved.totalHeight + spec.paddingY * 2,
      rotate: 0,
      z: 0,
    },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  // 배경 이미지 바로 뒤가 아니라, 배경 이미지 다음에 카드가 오도록 삽입한다.
  const backgroundCount = resolved.layers.findIndex((l) => l.role !== 'background');
  const insertAt = backgroundCount === -1 ? resolved.layers.length : backgroundCount;

  return [...resolved.layers.slice(0, insertAt), card, ...resolved.layers.slice(insertAt)];
}

function resolveTemplate(params: {
  forceTemplateId?: string;
  role: SlidePlan['role'];
  hasImage: boolean;
  hint: string | null;
  weights?: Record<string, number>;
  learned?: readonly Template[];
  seed: string;
}): Template {
  if (params.forceTemplateId) {
    // 강제 지정은 미리보기·테스트 경로다. 없는 id면 조용히 넘기지 않고 알린다.
    const forced = selectTemplate({
      role: params.role,
      hasImage: params.hasImage,
      hint: params.forceTemplateId,
      ...(params.weights ? { weights: params.weights } : {}),
      ...(params.learned ? { learned: params.learned } : {}),
      seed: params.seed,
    });
    if (forced.id !== params.forceTemplateId) {
      throw new Error(
        `템플릿 ${params.forceTemplateId}는 role=${params.role}, hasImage=${params.hasImage}에 쓸 수 없습니다`,
      );
    }
    return forced;
  }

  return selectTemplate({
    role: params.role,
    hasImage: params.hasImage,
    hint: params.hint,
    ...(params.weights ? { weights: params.weights } : {}),
    ...(params.learned ? { learned: params.learned } : {}),
    seed: params.seed,
  });
}

export type ComposeCardnewsOptions = {
  plan: CardnewsPlan;
  ratio: AspectRatio;
  brand?: BrandStyle;
  /** 슬라이드별 이미지. 인덱스가 맞아야 한다. 조달 전이면 빈 배열/undefined. */
  images?: (ResolvedImage | null)[];
  templateWeights?: Record<string, number>;
  /** Layouts read off reference designs. Used in place of the built-in set. */
  learnedLayouts?: PanelLayoutSpec[];
  seed: string;
  showPageNumber?: boolean;
  brandKitId?: string | null;
};

export type ComposedCardnews = {
  slides: ComposedSlide[];
  /** 전체 경고 (슬라이드 인덱스 포함) */
  warnings: (ComposeWarning & { slideIndex: number })[];
};

/** 카드뉴스 전체를 조판한다. */
export function composeCardnews(options: ComposeCardnewsOptions): ComposedCardnews {
  const { plan, images = [], ...rest } = options;

  const slides = plan.slides.map((slidePlan, index) =>
    composeSlide({
      plan: slidePlan,
      index,
      totalSlides: plan.slides.length,
      image: images[index] ?? null,
      ...rest,
    }),
  );

  const warnings = slides.flatMap((slide, slideIndex) =>
    slide.warnings.map((w) => ({ ...w, slideIndex })),
  );

  return { slides, warnings };
}

/**
 * 이미지 조달 전 임시 조판용 플레이스홀더 이미지.
 *
 * 실제 이미지를 기다리면 첫 화면이 늦어지므로, 무드로 휘도를 추정해 먼저 조판하고
 * 이미지가 도착하면 src와 실측 휘도로 갱신한다.
 */
export function placeholderImage(plan: SlidePlan): ResolvedImage {
  return {
    src: '',
    assetId: null,
    meanLuma: estimateLumaFromMood(plan.imageMood),
    stdDev: 0.12,
  };
}
