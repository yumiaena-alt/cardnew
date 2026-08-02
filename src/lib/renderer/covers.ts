import type { Layer } from '@/lib/slidedoc/layers';
import { planReadability, planToGradient } from './contrast';
import { presentIds } from './stack';
import { isLandscape, isTallPortrait, lumaForRegion, readabilityLuma } from './types';
import type { BuildContext, BuildResult, Template, TextRegion } from './types';

/**
 * 표지 템플릿 3종.
 *
 * 표지가 카드뉴스의 전환율을 결정한다 — 피드에서 이 한 장만 보고 넘길지 멈출지 정해진다.
 * 그래서 3종을 성격이 확실히 다르게 만든다: 하단 정렬 / 대형 타이포 / 카드 오버레이.
 * 비슷한 3종을 만들면 밴딧이 탐색할 의미가 없다.
 */

const INK = '#141210';
const PAPER = '#F8F5F0';
const MUTED_ON_DARK = '#B9B0A6';
const MUTED_ON_LIGHT = '#5C544B';
const ACCENT = '#C8632B';

/**
 * 배경 이미지 레이어 + 가독성 오버레이를 만든다.
 *
 * @param textRegion 이 템플릿의 텍스트가 놓이는 세로 위치.
 *   실측 밴드 중 이 영역의 휘도로 글자색·오버레이를 결정한다.
 *   overlayDirection과 다를 수 있다 — 중앙 텍스트에 전체 스크림을 깔는 경우 등.
 */
function backgroundLayers(
  context: BuildContext,
  headlineSize: number,
  headlineWeight: number,
  overlayDirection: 'bottom' | 'top' | 'full',
  textRegion: TextRegion,
): { layers: Layer[]; textColor: string; mutedColor: string; background: string } {
  const { image, brand } = context;

  if (!image) {
    // 이미지가 없으면 단색 배경. 브랜드 배경색이 있으면 그걸 쓴다.
    const bg = brand.palette.background ?? INK;
    const isDarkBg = isDark(bg);
    return {
      layers: [],
      textColor: brand.palette.text ?? (isDarkBg ? PAPER : INK),
      mutedColor: brand.palette.textMuted ?? (isDarkBg ? MUTED_ON_DARK : MUTED_ON_LIGHT),
      background: bg,
    };
  }

  // 텍스트가 실제로 놓일 영역의 실측 휘도를 쓴다.
  // 전체 평균이나 다른 영역 값을 쓰면 오버레이가 부족·과다해진다.
  const band = lumaForRegion(image, textRegion);

  // 글자색은 영역 평균으로 정하고(밝은 배경엔 어두운 글씨),
  // 오버레이 세기는 최악 케이스 백분위로 정한다(가장 밝은 부분에서도 읽히게).
  const isDarkImage = band.meanLuma < 0.5;
  const plan = planReadability(readabilityLuma(band), headlineSize, headlineWeight);
  const overlay = planToGradient(plan, overlayDirection);

  const bgLayer: Layer = {
    id: 'bg',
    type: 'image',
    role: 'background',
    assetId: image.assetId,
    src: image.src,
    focus: image.focus ?? { x: 0.5, y: 0.42 },
    fit: 'cover',
    scale: 1,
    flipX: false,
    flipY: false,
    radius: 0,
    filter: { brightness: 1, contrast: 1, saturate: 1, blur: 0, grayscale: 0 },
    ...(overlay ? { overlay } : {}),
    manualOverlay: false,
    hidden: false,
    locked: false,
    opacity: 1,
    layout: { anchor: 'top-left', x: 0, y: 0, w: 1, rotate: 0, z: 0 },
  };

  return {
    layers: [bgLayer],
    textColor: plan.textColor,
    mutedColor: isDarkImage ? MUTED_ON_DARK : MUTED_ON_LIGHT,
    background: isDarkImage ? INK : PAPER,
  };
}

function isDark(hex: string): boolean {
  const raw = hex.replace('#', '');
  if (raw.length < 6) {
    return true;
  }
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  // 단순 상대 밝기. 정확한 대비 판단은 contrast.ts가 하고, 여기서는 기본색 선택만 한다.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

// ─────────────────────────────────────────────────────────────
// 1. 하단 정렬 표지 — 사진을 최대한 살리고 텍스트를 아래에 모은다
// ─────────────────────────────────────────────────────────────

export const coverBottomStack: Template = {
  id: 'cover-bottom-stack',
  name: '하단 정렬 표지',
  roles: ['cover'],
  requiresImage: false,
  vibe: 'editorial',
  build(context): BuildResult {
    const { plan, ratio, brand, pageLabel } = context;

    // 가로형은 텍스트 블록을 좁혀야 한 줄이 너무 길어지지 않는다.
    const textWidth = isLandscape(ratio) ? 0.56 : 0.82;
    const headlineSize = isLandscape(ratio) ? 64 : 84;

    const bg = backgroundLayers(context, headlineSize, 700, 'bottom', 'bottom');
    const layers: Layer[] = [...bg.layers];

    // y는 스택 해석기가 실측 높이로 채운다. 여기 넣는 0은 자리표시자다.
    if (plan.body) {
      layers.push(
        text({
          id: 'body',
          role: 'body',
          content: plan.body,
          anchor: 'bottom-left',
          x: 0.1,
          y: 0,
          w: textWidth,
          size: 30,
          weight: brand.typography.bodyWeight ?? 400,
          family: brand.typography.bodyFamily ?? 'Pretendard',
          color: bg.mutedColor,
          lineHeight: 1.55,
          maxLines: 3,
          min: 22,
          max: 34,
        }),
      );
    }

    layers.push(
      text({
        id: 'headline',
        role: 'headline',
        content: plan.headline,
        anchor: 'bottom-left',
        x: 0.1,
        y: 0,
        w: textWidth,
        size: headlineSize,
        weight: brand.typography.headingWeight ?? 700,
        family: brand.typography.headingFamily ?? 'Noto Serif KR',
        color: bg.textColor,
        lineHeight: 1.3,
        letterSpacing: -0.03,
        maxLines: 3,
        min: 42,
        max: headlineSize,
        shadow: context.image ? { x: 0, y: 2, blur: 18, color: '#00000055' } : undefined,
      }),
    );

    if (plan.eyebrow) {
      layers.push(
        text({
          id: 'eyebrow',
          role: 'eyebrow',
          content: plan.eyebrow,
          anchor: 'bottom-left',
          x: 0.1,
          y: 0,
          w: textWidth,
          size: 27,
          weight: 600,
          family: 'Pretendard',
          color: brand.palette.accent ?? ACCENT,
          letterSpacing: 0.18,
          lineHeight: 1.2,
          maxLines: 1,
          autoFit: false,
        }),
      );
    }

    if (pageLabel) {
      layers.push(pageNumber(pageLabel, bg.mutedColor));
    }

    return {
      layers,
      background: { kind: 'solid', color: bg.background },
      // 아래에서 위로: body → headline → eyebrow
      stack: {
        from: 'bottom',
        order: presentIds(layers, ['body', 'headline', 'eyebrow']),
        start: 0.08,
        gap: 0.028,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// 2. 대형 타이포 표지 — 제목이 화면을 지배한다
// ─────────────────────────────────────────────────────────────

export const coverBoldType: Template = {
  id: 'cover-bold-type',
  name: '대형 타이포 표지',
  roles: ['cover'],
  requiresImage: false,
  vibe: 'bold',
  build(context): BuildResult {
    const { plan, ratio, brand, pageLabel } = context;

    const headlineSize = isLandscape(ratio) ? 88 : 112;
    const bg = backgroundLayers(context, headlineSize, 900, 'full', 'middle');
    const layers: Layer[] = [...bg.layers];

    if (plan.eyebrow) {
      layers.push(
        text({
          id: 'eyebrow',
          role: 'eyebrow',
          content: plan.eyebrow,
          anchor: 'top-left',
          x: 0.1,
          y: 0.14,
          w: 0.8,
          size: 28,
          weight: 700,
          family: 'Pretendard',
          color: brand.palette.accent ?? ACCENT,
          letterSpacing: 0.2,
          lineHeight: 1.2,
          maxLines: 1,
          autoFit: false,
        }),
      );
    }

    // 제목을 세로 중앙에 두고 크게. 대형 타이포는 여백보다 존재감이 목적이다.
    layers.push(
      text({
        id: 'headline',
        role: 'headline',
        content: plan.headline,
        anchor: 'middle-left',
        x: 0.1,
        y: plan.body ? -0.04 : 0,
        w: 0.84,
        size: headlineSize,
        weight: brand.typography.headingWeight ?? 900,
        family: brand.typography.headingFamily ?? 'Pretendard',
        color: bg.textColor,
        lineHeight: 1.16,
        letterSpacing: -0.045,
        maxLines: 4,
        min: 52,
        max: headlineSize,
        shadow: context.image ? { x: 0, y: 3, blur: 24, color: '#00000066' } : undefined,
      }),
    );

    if (plan.body) {
      layers.push(
        text({
          id: 'body',
          role: 'body',
          content: plan.body,
          anchor: 'bottom-left',
          x: 0.1,
          y: 0.1,
          w: 0.78,
          size: 30,
          weight: brand.typography.bodyWeight ?? 400,
          family: brand.typography.bodyFamily ?? 'Pretendard',
          color: bg.mutedColor,
          lineHeight: 1.55,
          maxLines: 3,
          min: 22,
          max: 34,
        }),
      );
    }

    if (pageLabel) {
      layers.push(pageNumber(pageLabel, bg.mutedColor));
    }

    return { layers, background: { kind: 'solid', color: bg.background } };
  },
};

// ─────────────────────────────────────────────────────────────
// 3. 카드 오버레이 표지 — 사진 위에 불투명 카드를 얹는다
// ─────────────────────────────────────────────────────────────

export const coverCardOverlay: Template = {
  id: 'cover-card-overlay',
  name: '카드 오버레이 표지',
  roles: ['cover'],
  requiresImage: true,
  vibe: 'card',
  build(context): BuildResult {
    const { plan, ratio, brand, image, pageLabel } = context;

    const headlineSize = isLandscape(ratio) ? 56 : 68;
    // 카드가 배경을 가리므로 오버레이는 약하게만 준다.
    const bg = backgroundLayers(context, headlineSize, 700, 'bottom', 'bottom');
    const layers: Layer[] = [...bg.layers];

    // 카드 안쪽은 배경 이미지와 무관하게 대비가 확보되므로 고정 색을 쓴다.
    const cardIsDark = image ? image.meanLuma >= 0.5 : true;
    const cardColor = cardIsDark ? '#141210F2' : '#F8F5F0F2';
    const cardText = cardIsDark ? PAPER : INK;
    const cardMuted = cardIsDark ? MUTED_ON_DARK : MUTED_ON_LIGHT;

    const cardWidth = isLandscape(ratio) ? 0.52 : 0.82;
    // 9:16은 세로가 길어 카드를 조금 더 위로 올려야 플랫폼 UI에 안 가린다.
    const cardBottom = isTallPortrait(ratio) ? 0.14 : 0.1;

    // 카드 안쪽 콘텐츠. 카드 패딩만큼 안으로 들여쓴다.
    const cardPaddingX = 0.05;
    const cardPaddingY = 0.045;
    const innerX = 0.09 + cardPaddingX;
    const innerWidth = cardWidth - cardPaddingX * 2;

    if (plan.body) {
      layers.push(
        text({
          id: 'body',
          role: 'body',
          content: plan.body,
          anchor: 'bottom-left',
          x: innerX,
          y: 0,
          w: innerWidth,
          size: 28,
          weight: brand.typography.bodyWeight ?? 400,
          family: brand.typography.bodyFamily ?? 'Pretendard',
          color: cardMuted,
          lineHeight: 1.5,
          // body 상한은 스키마상 90자다. 2줄로는 최소 크기에서도 안 들어가므로 4줄까지 허용한다.
          maxLines: 4,
          min: 17,
          max: 30,
        }),
      );
    }

    layers.push(
      text({
        id: 'headline',
        role: 'headline',
        content: plan.headline,
        anchor: 'bottom-left',
        x: innerX,
        y: 0,
        w: innerWidth,
        size: headlineSize,
        weight: brand.typography.headingWeight ?? 700,
        family: brand.typography.headingFamily ?? 'Noto Serif KR',
        color: cardText,
        lineHeight: 1.28,
        letterSpacing: -0.03,
        maxLines: 2,
        min: 36,
        max: headlineSize,
      }),
    );

    if (plan.eyebrow) {
      layers.push(
        text({
          id: 'eyebrow',
          role: 'eyebrow',
          content: plan.eyebrow,
          anchor: 'bottom-left',
          x: innerX,
          y: 0,
          w: innerWidth,
          size: 24,
          weight: 600,
          family: 'Pretendard',
          color: brand.palette.accent ?? ACCENT,
          letterSpacing: 0.16,
          lineHeight: 1.2,
          maxLines: 1,
          autoFit: false,
        }),
      );
    }

    if (pageLabel) {
      layers.push(pageNumber(pageLabel, bg.textColor));
    }

    return {
      layers,
      background: { kind: 'solid', color: bg.background },
      stack: {
        from: 'bottom',
        order: presentIds(layers, ['body', 'headline', 'eyebrow']),
        start: cardBottom + cardPaddingY,
        gap: 0.025,
      },
      /**
       * 카드는 스택 높이가 확정된 뒤에 그려야 한다.
       * 고정 높이를 주면 카피 길이에 따라 텍스트가 카드를 넘거나 카드가 텅 빈다.
       */
      backdrop: {
        id: 'card',
        color: cardColor,
        radius: 20,
        x: 0.09,
        w: cardWidth,
        bottom: cardBottom,
        paddingY: cardPaddingY,
      },
    };
  },
};

// ─── 공용 레이어 빌더 ────────────────────────────────────────

type TextSpec = {
  id: string;
  role: 'headline' | 'subhead' | 'body' | 'caption' | 'badge' | 'eyebrow' | 'pagenum';
  content: string;
  anchor: 'top-left' | 'bottom-left' | 'middle-left' | 'bottom-right' | 'top-right';
  x: number;
  y: number;
  w: number;
  size: number;
  weight: number;
  family: string;
  color: string;
  lineHeight: number;
  letterSpacing?: number;
  maxLines: number;
  min?: number;
  max?: number;
  align?: 'left' | 'center' | 'right';
  autoFit?: boolean;
  shadow?: { x: number; y: number; blur: number; color: string } | undefined;
};

/** 텍스트 레이어를 만든다. 반복되는 기본값을 여기서 한 번만 채운다. */
export function text(spec: TextSpec): Layer {
  return {
    id: spec.id,
    type: 'text',
    role: spec.role,
    text: spec.content,
    hidden: false,
    locked: false,
    opacity: 1,
    layout: {
      anchor: spec.anchor,
      x: spec.x,
      y: spec.y,
      w: spec.w,
      rotate: 0,
      z: 0,
    },
    style: {
      family: spec.family,
      weight: spec.weight as 400,
      size: spec.size,
      autoFit: {
        enabled: spec.autoFit ?? true,
        min: spec.min ?? Math.round(spec.size * 0.6),
        max: spec.max ?? spec.size,
        maxLines: spec.maxLines,
      },
      color: spec.color,
      align: spec.align ?? 'left',
      lineHeight: spec.lineHeight,
      letterSpacing: spec.letterSpacing ?? -0.01,
      italic: false,
      underline: false,
      strike: false,
      transform: 'none',
      ...(spec.shadow ? { shadow: spec.shadow } : {}),
    },
  };
}

export function pageNumber(label: string, color: string): Layer {
  return text({
    id: 'pagenum',
    role: 'pagenum',
    content: label,
    anchor: 'bottom-right',
    x: 0.07,
    y: 0.045,
    w: 0.2,
    size: 23,
    weight: 500,
    family: 'Pretendard',
    color,
    lineHeight: 1.2,
    letterSpacing: 0.02,
    maxLines: 1,
    align: 'right',
    autoFit: false,
  });
}

export { INK, PAPER, MUTED_ON_DARK, MUTED_ON_LIGHT, ACCENT, isDark, backgroundLayers };
