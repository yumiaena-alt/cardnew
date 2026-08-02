import sharp from 'sharp';

/**
 * 배경 이미지 휘도 분석 (차별점 #2의 마지막 조각).
 *
 * 핵심: **전체 평균 휘도는 쓸모없다.**
 * 하늘이 밝고 땅이 어두운 사진의 평균은 중간값인데, 텍스트가 하늘 위에 놓이면
 * 흰 글씨가 사라진다. 텍스트가 실제로 놓일 영역만 재야 의미가 있다.
 *
 * 그래서 이미지를 세로 3분할(위/중간/아래)로 재고, 템플릿이 자기 텍스트 위치에
 * 맞는 밴드를 골라 쓴다.
 */

export type LumaBand = {
  /** 평균 휘도 0~1 (WCAG 상대 휘도) */
  meanLuma: number;
  /** 표준편차. 높으면 배경이 복잡해 오버레이를 더 세게 해야 한다. */
  stdDev: number;
  /**
   * 90번째 백분위 휘도 — **가독성 판단에는 이 값을 써야 한다.**
   *
   * 평균을 쓰면 어두운 배경에 밝은 피사체가 있는 사진(예: 어두운 나무 위 황금색 타르트)에서
   * 흰 글씨가 밝은 부분과 겹쳐 읽히지 않는다. 평균은 어둡다고 판단하기 때문이다.
   * 텍스트가 지나가는 **가장 밝은 부분**을 기준으로 삼아야 안전하다.
   */
  p90Luma: number;
  /** 10번째 백분위. 어두운 글씨를 쓸 때의 최악 케이스. */
  p10Luma: number;
};

export type LumaAnalysis = {
  /** 상단 1/3 */
  top: LumaBand;
  /** 중간 1/3 */
  middle: LumaBand;
  /** 하단 1/3 */
  bottom: LumaBand;
  /** 전체 (참고용, 판단에는 쓰지 말 것) */
  overall: LumaBand;
  width: number;
  height: number;
};

/** 텍스트가 놓일 영역 */
export type TextRegion = 'top' | 'middle' | 'bottom' | 'full';

/**
 * 이미지 휘도를 분석한다.
 *
 * 성능: 분석 전에 작게 리사이즈한다. 원본 해상도로 재도 결과가 거의 같은데
 * 비용은 수십 배다. 128px면 평균·표준편차 계산에 충분하다.
 */
export async function analyzeLuma(input: Buffer | Uint8Array): Promise<LumaAnalysis> {
  const ANALYSIS_WIDTH = 128;

  const image = sharp(input);
  const metadata = await image.metadata();

  // greyscale로 변환하면 sharp가 이미 인간 시각 가중치를 적용한 luma를 만든다.
  // 채널별로 직접 계산하는 것보다 빠르고 결과도 일관된다.
  const { data, info } = await image
    .resize(ANALYSIS_WIDTH, null, { fit: 'inside', withoutEnlargement: false })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const bandHeight = Math.floor(height / 3);

  return {
    top: measureBand(data, width, 0, bandHeight),
    middle: measureBand(data, width, bandHeight, bandHeight * 2),
    bottom: measureBand(data, width, bandHeight * 2, height),
    overall: measureBand(data, width, 0, height),
    width: metadata.width ?? width,
    height: metadata.height ?? height,
  };
}

/**
 * 픽셀 행 구간의 평균·표준편차를 구한다.
 *
 * sRGB 값을 선형 휘도로 변환해야 WCAG 대비 계산과 단위가 맞는다.
 * 단순히 0~255를 255로 나누면 감마 때문에 어두운 쪽이 과대평가된다.
 */
function measureBand(
  data: Buffer | Uint8Array,
  width: number,
  startRow: number,
  endRow: number,
): LumaBand {
  const start = startRow * width;
  const end = Math.min(endRow * width, data.length);
  const count = end - start;

  if (count <= 0) {
    return { meanLuma: 0.5, stdDev: 0, p90Luma: 0.5, p10Luma: 0.5 };
  }

  const values = new Float64Array(count);
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const luma = srgbToLinear(data[start + i]! / 255);
    values[i] = luma;
    sum += luma;
  }
  const mean = sum / count;

  let variance = 0;
  for (let i = 0; i < count; i += 1) {
    const diff = values[i]! - mean;
    variance += diff * diff;
  }

  // 정렬 후 백분위를 뽑는다. 128px 폭 리사이즈 덕에 픽셀 수가 적어 정렬 비용이 무의미하다.
  values.sort();

  return {
    meanLuma: clamp01(mean),
    stdDev: clamp01(Math.sqrt(variance / count)),
    p90Luma: clamp01(values[Math.floor(count * 0.9)] ?? mean),
    p10Luma: clamp01(values[Math.floor(count * 0.1)] ?? mean),
  };
}

/** sRGB → 선형 (WCAG 2.x 정의). contrast.ts의 channelLuminance와 같은 공식이어야 한다. */
function srgbToLinear(channel: number): number {
  return channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 텍스트 영역에 해당하는 밴드를 고른다. */
export function bandForRegion(analysis: LumaAnalysis, region: TextRegion): LumaBand {
  switch (region) {
    case 'top': {
      return analysis.top;
    }
    case 'middle': {
      return analysis.middle;
    }
    case 'bottom': {
      return analysis.bottom;
    }
    case 'full': {
      return analysis.overall;
    }
  }
}

/**
 * 가장 텍스트를 얹기 좋은 영역을 추천한다.
 *
 * 기준: 극단값(아주 밝거나 아주 어두운)이면서 편차가 작은 영역.
 * 중간 휘도 + 복잡한 배경이 가장 나쁘다 — 오버레이를 세게 넣어야 해서 사진이 죽는다.
 */
export function bestTextRegion(analysis: LumaAnalysis): TextRegion {
  const candidates: { region: TextRegion; band: LumaBand }[] = [
    { region: 'bottom', band: analysis.bottom },
    { region: 'top', band: analysis.top },
    { region: 'middle', band: analysis.middle },
  ];

  const scored = candidates.map(({ region, band }) => ({
    region,
    // 0.5에서 멀수록 좋고(극단값), 편차가 작을수록 좋다
    score: Math.abs(band.meanLuma - 0.5) * 2 - band.stdDev,
  }));

  // 동점이면 candidates 순서(bottom 우선)를 유지한다 — 대부분 템플릿이 하단 정렬이다.
  return scored.reduce((best, current) => (current.score > best.score ? current : best)).region;
}
