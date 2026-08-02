import type { Layer } from '@/lib/slidedoc/layers';
import {
  ACCENT,
  backgroundLayers,
  INK,
  MUTED_ON_DARK,
  MUTED_ON_LIGHT,
  PAPER,
  pageNumber,
  text,
} from './covers';
import { presentIds } from './stack';
import { isLandscape } from './types';
import type { BuildResult, Template } from './types';

/**
 * 본문 템플릿 3종.
 *
 * 본문은 표지와 반대 원칙을 쓴다: 읽기 쉬움이 최우선.
 * 사진 위 텍스트보다 여백과 대비가 중요하므로 3종 모두 이미지를 필수로 두지 않는다.
 */

// ─────────────────────────────────────────────────────────────
// 4. 번호 강조 본문 — 순서가 있는 내용에 쓴다
// ─────────────────────────────────────────────────────────────

export const bodyNumbered: Template = {
  id: 'body-numbered',
  name: '번호 강조 본문',
  roles: ['point', 'example', 'problem'],
  requiresImage: false,
  vibe: 'editorial',
  build(context): BuildResult {
    const { plan, ratio, brand, pageLabel, image } = context;

    const headlineSize = isLandscape(ratio) ? 54 : 66;
    // 제목은 상단, 본문은 하단에 흩어져 있으므로 전체 평균 휘도를 기준으로 삼는다.
    const bg = backgroundLayers(context, headlineSize, 700, 'full', 'full');
    const layers: Layer[] = [...bg.layers];

    const accent = brand.palette.accent ?? ACCENT;

    // eyebrow를 번호 배지로 쓴다. LLM이 "STEP 01" 같은 값을 넣어주면 그대로 살고,
    // 없으면 페이지 번호에서 만들어 순서 감각을 준다.
    const badge = plan.eyebrow ?? (pageLabel ? (pageLabel.split('/')[0]?.trim() ?? null) : null);

    if (badge) {
      layers.push(
        text({
          id: 'badge',
          role: 'badge',
          content: badge,
          anchor: 'top-left',
          x: 0.1,
          y: 0.15,
          w: 0.5,
          size: 40,
          weight: 800,
          family: 'Pretendard',
          color: accent,
          lineHeight: 1.1,
          letterSpacing: 0.02,
          maxLines: 1,
          autoFit: false,
        }),
      );
    }

    // 배지 아래 구분선 — 시선을 제목으로 끌어내린다.
    layers.push({
      id: 'divider',
      type: 'shape',
      role: 'divider',
      shape: 'rect',
      fill: { kind: 'solid', color: accent },
      radius: 0,
      layout: {
        anchor: 'top-left',
        x: 0.1,
        y: badge ? 0.225 : 0.16,
        w: 0.1,
        h: 0.006,
        rotate: 0,
        z: 0,
      },
      hidden: false,
      locked: false,
      opacity: 1,
    });

    layers.push(
      text({
        id: 'headline',
        role: 'headline',
        content: plan.headline,
        anchor: 'top-left',
        x: 0.1,
        y: badge ? 0.27 : 0.2,
        w: 0.82,
        size: headlineSize,
        weight: brand.typography.headingWeight ?? 700,
        family: brand.typography.headingFamily ?? 'Noto Serif KR',
        color: bg.textColor,
        lineHeight: 1.32,
        letterSpacing: -0.03,
        maxLines: 3,
        min: 36,
        max: headlineSize,
        shadow: image ? { x: 0, y: 2, blur: 16, color: '#00000044' } : undefined,
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
          y: 0.12,
          w: 0.82,
          size: 32,
          weight: brand.typography.bodyWeight ?? 400,
          family: brand.typography.bodyFamily ?? 'Pretendard',
          color: bg.mutedColor,
          lineHeight: 1.6,
          maxLines: 4,
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
// 5. 인용 본문 — 한 문장을 크게 보여준다
// ─────────────────────────────────────────────────────────────

export const bodyQuote: Template = {
  id: 'body-quote',
  name: '인용 본문',
  roles: ['quote', 'point'],
  requiresImage: false,
  vibe: 'minimal',
  build(context): BuildResult {
    const { plan, ratio, brand, pageLabel } = context;

    const headlineSize = isLandscape(ratio) ? 66 : 78;
    // 인용 블록은 세로 중앙에 모이므로 중앙 밴드 휘도를 쓴다.
    const bg = backgroundLayers(context, headlineSize, 700, 'full', 'middle');
    const layers: Layer[] = [...bg.layers];

    const accent = brand.palette.accent ?? ACCENT;

    // 큰 따옴표 글리프를 장식으로 쓴다. 별도 이미지 없이 인용 느낌을 낸다.
    // 스택에 포함시킨다 — 고정 위치로 두면 카피가 길어질 때 인용문이 올라와 겹친다.
    layers.push(
      text({
        id: 'quotemark',
        role: 'badge',
        content: '"',
        anchor: 'middle-left',
        x: 0.095,
        y: 0,
        w: 0.3,
        size: 116,
        weight: 700,
        family: 'Noto Serif KR',
        color: accent,
        lineHeight: 0.9,
        maxLines: 1,
        autoFit: false,
      }),
    );

    // 인용문은 세로 중앙에 둔다. 여백이 인용의 무게를 만든다.
    layers.push(
      text({
        id: 'headline',
        role: 'headline',
        content: plan.headline,
        anchor: 'middle-left',
        x: 0.1,
        y: 0,
        w: 0.8,
        size: headlineSize,
        weight: brand.typography.headingWeight ?? 700,
        family: brand.typography.headingFamily ?? 'Noto Serif KR',
        color: bg.textColor,
        lineHeight: 1.42,
        letterSpacing: -0.025,
        maxLines: 4,
        min: 40,
        max: headlineSize,
      }),
    );

    if (plan.body) {
      layers.push(
        text({
          id: 'body',
          role: 'caption',
          content: plan.body,
          anchor: 'middle-left',
          x: 0.1,
          y: 0,
          w: 0.8,
          size: 28,
          weight: brand.typography.bodyWeight ?? 500,
          family: brand.typography.bodyFamily ?? 'Pretendard',
          color: bg.mutedColor,
          lineHeight: 1.5,
          // 90자 body를 최소 크기에서도 수납할 수 있게 4줄까지 허용한다.
          maxLines: 4,
          min: 17,
          max: 30,
        }),
      );
    }

    if (pageLabel) {
      layers.push(pageNumber(pageLabel, bg.mutedColor));
    }

    return {
      layers,
      background: { kind: 'solid', color: bg.background },
      // 따옴표 + 인용문 + 보조설명을 하나의 블록으로 세로 중앙 정렬한다.
      stack: {
        from: 'middle',
        order: presentIds(layers, ['quotemark', 'headline', 'body']),
        start: 0,
        gap: 0.022,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// 6. CTA 본문 — 행동을 유도하는 마지막 장
// ─────────────────────────────────────────────────────────────

export const bodyCta: Template = {
  id: 'body-cta',
  name: 'CTA 마무리',
  roles: ['cta'],
  requiresImage: false,
  vibe: 'bold',
  build(context): BuildResult {
    const { plan, ratio, brand, image } = context;

    const headlineSize = isLandscape(ratio) ? 66 : 82;
    const bg = backgroundLayers(context, headlineSize, 800, 'full', 'middle');
    const layers: Layer[] = [...bg.layers];

    const accent = brand.palette.accent ?? ACCENT;

    if (plan.eyebrow) {
      layers.push(
        text({
          id: 'eyebrow',
          role: 'eyebrow',
          content: plan.eyebrow,
          anchor: 'middle-left',
          x: 0.1,
          y: 0,
          w: 0.8,
          size: 28,
          weight: 700,
          family: 'Pretendard',
          color: accent,
          letterSpacing: 0.18,
          lineHeight: 1.2,
          maxLines: 1,
          autoFit: false,
        }),
      );
    }

    layers.push(
      text({
        id: 'headline',
        role: 'headline',
        content: plan.headline,
        anchor: 'middle-left',
        x: 0.1,
        y: 0,
        w: 0.82,
        size: headlineSize,
        weight: brand.typography.headingWeight ?? 800,
        family: brand.typography.headingFamily ?? 'Pretendard',
        color: bg.textColor,
        lineHeight: 1.24,
        letterSpacing: -0.04,
        maxLines: 3,
        min: 44,
        max: headlineSize,
        shadow: image ? { x: 0, y: 2, blur: 20, color: '#00000055' } : undefined,
      }),
    );

    if (plan.body) {
      layers.push(
        text({
          id: 'body',
          role: 'body',
          content: plan.body,
          anchor: 'middle-left',
          x: 0.1,
          y: 0,
          w: 0.78,
          size: 30,
          weight: brand.typography.bodyWeight ?? 400,
          family: brand.typography.bodyFamily ?? 'Pretendard',
          color: bg.mutedColor,
          lineHeight: 1.55,
          maxLines: 4,
          min: 18,
          max: 32,
        }),
      );
    }

    // 로고가 있으면 하단에 배치한다. CTA 장은 브랜드를 각인시키는 자리다.
    // 스택 밖에 두므로 중앙 블록과 독립적으로 고정된다.
    if (brand.logo?.src) {
      layers.push({
        id: 'logo',
        type: 'logo',
        role: 'logo',
        assetId: brand.logo.assetId,
        src: brand.logo.src,
        variant: 'default',
        hidden: false,
        locked: false,
        opacity: 1,
        layout: { anchor: 'bottom-left', x: 0.1, y: 0.09, w: 0.22, rotate: 0, z: 0 },
      });
    }

    return {
      layers,
      background: { kind: 'solid', color: bg.background },
      // eyebrow → headline → body를 한 블록으로 세로 중앙 정렬한다.
      // 고정 오프셋을 쓰면 짧은 캔버스(1:1)에서 서로 겹친다.
      stack: {
        from: 'middle',
        order: presentIds(layers, ['eyebrow', 'headline', 'body']),
        start: 0,
        gap: 0.03,
      },
    };
  },
};

export { INK, PAPER, MUTED_ON_DARK, MUTED_ON_LIGHT };
