/**
 * WCAG 대비 계산 + 가독성 보장 (차별점 #2).
 *
 * 배경 이미지 위에 흰 글씨를 얹으면 밝은 사진에서 글자가 사라진다.
 * 고정 그라데이션 오버레이로 덮는 방식은 어두운 사진에서 과하고 밝은 사진에서
 * 모자란다. 여기서는 실측한 배경 휘도로 오버레이 강도·글자색·웨이트를 자동
 * 결정해 4.5:1을 강제한다.
 *
 * 이 모듈은 순수 함수만 담는다. 실제 이미지 픽셀 분석은 서버에서 sharp가 하고,
 * 그 결과(LumaAnalysis)를 여기에 넘긴다. 그래야 브라우저·서버 양쪽에서 재사용된다.
 */

export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3;

/** 큰 글씨 기준(WCAG): 18.66px 이상 bold, 또는 24px 이상. base 1080 캔버스 기준으로 환산해 사용한다. */
export function isLargeText(sizePx: number, weight: number): boolean {
  return sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
}

export function requiredContrast(sizePx: number, weight: number): number {
  return isLargeText(sizePx, weight) ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
}

export type Rgb = { r: number; g: number; b: number };

export function parseColor(input: string): Rgb | null {
  const value = input.trim();

  if (value.startsWith('#')) {
    const raw = value.slice(1);
    if (raw.length === 3 || raw.length === 4) {
      const [r, g, b] = [raw.charAt(0), raw.charAt(1), raw.charAt(2)];
      return {
        r: Number.parseInt(r + r, 16),
        g: Number.parseInt(g + g, 16),
        b: Number.parseInt(b + b, 16),
      };
    }
    if (raw.length === 6 || raw.length === 8) {
      return {
        r: Number.parseInt(raw.slice(0, 2), 16),
        g: Number.parseInt(raw.slice(2, 4), 16),
        b: Number.parseInt(raw.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/iu.exec(value);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  return null;
}

/** hex/rgba 문자열의 알파값(0~1). 알파 정보가 없으면 1. */
export function parseAlpha(input: string): number {
  const value = input.trim();

  if (value === 'transparent') {
    return 0;
  }

  if (value.startsWith('#')) {
    const raw = value.slice(1);
    if (raw.length === 4) {
      return Number.parseInt(raw[3]! + raw[3]!, 16) / 255;
    }
    if (raw.length === 8) {
      return Number.parseInt(raw.slice(6, 8), 16) / 255;
    }
    return 1;
  }

  const alphaMatch = /^rgba?\([^)]*?[\s,/]+([\d.]+)\s*\)$/iu.exec(value);
  if (alphaMatch) {
    const parts = value
      .replaceAll(/^rgba?\(|\)$/giu, '')
      .split(/[\s,/]+/u)
      .filter(Boolean);
    if (parts.length >= 4) {
      return Math.min(Math.max(Number(parts[3]), 0), 1);
    }
  }

  return 1;
}

/** sRGB 채널 → 선형 휘도 기여분 (WCAG 2.x 정의) */
function channelLuminance(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 상대 휘도 0(검정) ~ 1(흰색) */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** WCAG 대비율 1:1 ~ 21:1 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastRatioFromStrings(a: string, b: string): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) {
    return null;
  }
  return contrastRatio(ca, cb);
}

/** 반투명 전경색을 배경 위에 알파 합성한 결과. 오버레이 효과 계산에 쓴다. */
export function alphaComposite(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  const a = Math.min(Math.max(alpha, 0), 1);
  return {
    r: foreground.r * a + background.r * (1 - a),
    g: foreground.g * a + background.g * (1 - a),
    b: foreground.b * a + background.b * (1 - a),
  };
}

// ─── 배경 분석 → 자동 결정 ───────────────────────────────────

/**
 * 서버(sharp)가 측정한 배경 이미지 휘도 분석.
 * 텍스트가 놓일 영역만 잘라서 측정해야 의미가 있다. 전체 평균은 쓸모없다.
 */
export type LumaAnalysis = {
  /** 텍스트 영역 평균 휘도 0~1. **글자색(흰/검정) 결정에 쓴다.** */
  meanLuma: number;
  /** 휘도 표준편차. 높으면 배경이 복잡해 오버레이를 더 세게 해야 한다. */
  stdDev: number;
  /**
   * 최악 케이스 휘도. **오버레이 세기 결정에만 쓴다.**
   *
   * 왜 분리하는가: 어두운 나무 위 밝은 타르트 사진에서 평균은 0.23(어두움)인데
   * 텍스트가 지나가는 가장 밝은 부분은 0.54다. 하나의 숫자로 둘을 결정하면
   *  - 평균을 쓰면 → 흰 글씨는 맞지만 오버레이가 부족해 밝은 부분에서 안 읽힘
   *  - 최악값을 쓰면 → 오버레이는 충분하지만 "밝은 배경"으로 오판해 검정 글씨를 고름
   * 그래서 색은 평균으로, 세기는 최악값으로 정한다.
   */
  worstCaseLuma?: number;
};

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const NEAR_BLACK: Rgb = { r: 17, g: 17, b: 17 };

export type ReadabilityPlan = {
  /** 권장 텍스트 색 */
  textColor: string;
  /** 오버레이 불투명도 0~1. 0이면 오버레이 불필요. */
  overlayOpacity: number;
  /** 오버레이 색 (텍스트와 반대 극) */
  overlayColor: string;
  /** 이 계획 적용 후 예상 대비율 */
  resultingContrast: number;
  /** 요구 대비를 만족하는지 */
  meetsRequirement: boolean;
};

const MAX_OVERLAY_OPACITY = 0.75; // 이보다 세면 사진이 안 보여 카드뉴스 의미가 없다
const OVERLAY_STEP = 0.05;

/**
 * 배경 휘도로부터 텍스트 색과 오버레이 강도를 결정한다.
 *
 * 전략:
 *  1) 밝은 배경 → 어두운 글씨 + 흰 오버레이, 어두운 배경 → 흰 글씨 + 검정 오버레이
 *  2) 오버레이 없이 요구 대비를 넘으면 오버레이를 넣지 않는다(사진을 살린다)
 *  3) 못 넘으면 0.05씩 올려가며 최소 불투명도를 찾는다
 *  4) 상한까지 올려도 안 되면 meetsRequirement=false를 반환해
 *     호출부가 스크림(불투명 박스) 같은 더 강한 수단을 쓰게 한다
 */
export function planReadability(
  analysis: LumaAnalysis,
  fontSizePx: number,
  fontWeight: number,
): ReadabilityPlan {
  const required = requiredContrast(fontSizePx, fontWeight);

  // 글자색은 **평균** 휘도로 정한다. 최악값으로 정하면 색 선택이 뒤집힌다.
  const isDarkBackground = analysis.meanLuma < 0.5;

  // 오버레이 세기는 **최악 케이스** 휘도로 정한다. 없으면 평균을 쓴다.
  const strengthLuma = analysis.worstCaseLuma ?? analysis.meanLuma;

  // 복잡한 배경(stdDev 큼)은 더 불리한 쪽으로 보정한다.
  const complexityPenalty = Math.min(analysis.stdDev, 0.25);

  const effectiveLuma = isDarkBackground
    ? Math.min(strengthLuma + complexityPenalty, 1)
    : Math.max(strengthLuma - complexityPenalty, 0);

  const background = lumaToGray(effectiveLuma);
  const textColor = isDarkBackground ? WHITE : NEAR_BLACK;
  const overlayColor = isDarkBackground ? NEAR_BLACK : WHITE;

  const bare = contrastRatio(textColor, background);
  if (bare >= required) {
    return {
      textColor: rgbToHex(textColor),
      overlayOpacity: 0,
      overlayColor: rgbToHex(overlayColor),
      resultingContrast: round2(bare),
      meetsRequirement: true,
    };
  }

  for (let opacity = OVERLAY_STEP; opacity <= MAX_OVERLAY_OPACITY + 1e-9; opacity += OVERLAY_STEP) {
    const composited = alphaComposite(overlayColor, opacity, background);
    const ratio = contrastRatio(textColor, composited);
    if (ratio >= required) {
      return {
        textColor: rgbToHex(textColor),
        overlayOpacity: round2(opacity),
        overlayColor: rgbToHex(overlayColor),
        resultingContrast: round2(ratio),
        meetsRequirement: true,
      };
    }
  }

  const worst = alphaComposite(overlayColor, MAX_OVERLAY_OPACITY, background);
  return {
    textColor: rgbToHex(textColor),
    overlayOpacity: MAX_OVERLAY_OPACITY,
    overlayColor: rgbToHex(overlayColor),
    resultingContrast: round2(contrastRatio(textColor, worst)),
    meetsRequirement: false,
  };
}

/** 선형 휘도값을 같은 휘도의 회색 sRGB로 역변환. */
export function lumaToGray(luma: number): Rgb {
  const clamped = Math.min(Math.max(luma, 0), 1);
  const linear =
    clamped <= 0.003_130_8 / 12.92 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  const channel = Math.round(Math.min(Math.max(linear, 0), 1) * 255);
  return { r: channel, g: channel, b: channel };
}

const toHexByte = (n: number) =>
  Math.round(Math.min(Math.max(n, 0), 255))
    .toString(16)
    .padStart(2, '0');

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * ReadabilityPlan을 SlideDoc 오버레이 그라데이션으로 변환한다.
 * 텍스트가 놓인 쪽만 어둡게 하는 방향성 그라데이션이 사진을 더 살린다.
 */
export function planToGradient(
  plan: ReadabilityPlan,
  direction: 'top' | 'bottom' | 'full' = 'bottom',
) {
  if (plan.overlayOpacity === 0) {
    // The contract is "a gradient or none" and the other branches return a
    // value, so a bare `return` would make the returns inconsistent.
    // oxlint-disable-next-line unicorn/no-useless-undefined
    return undefined;
  }

  const solid = withAlpha(plan.overlayColor, plan.overlayOpacity);
  const clear = withAlpha(plan.overlayColor, 0);

  if (direction === 'full') {
    return {
      type: 'linear' as const,
      angle: 180,
      stops: [
        { at: 0, color: solid },
        { at: 1, color: solid },
      ],
    };
  }

  return direction === 'bottom'
    ? {
        type: 'linear' as const,
        angle: 180,
        stops: [
          { at: 0, color: clear },
          { at: 0.45, color: withAlpha(plan.overlayColor, plan.overlayOpacity * 0.35) },
          { at: 1, color: solid },
        ],
      }
    : {
        type: 'linear' as const,
        angle: 0,
        stops: [
          { at: 0, color: clear },
          { at: 0.45, color: withAlpha(plan.overlayColor, plan.overlayOpacity * 0.35) },
          { at: 1, color: solid },
        ],
      };
}

/** hex 색상에 알파를 붙인 #RRGGBBAA를 만든다. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseColor(hex);
  if (!rgb) {
    return hex;
  }
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${rgbToHex(rgb)}${a.toUpperCase()}`;
}
