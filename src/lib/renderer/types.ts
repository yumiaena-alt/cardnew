import type { ImageMood, SlidePlan } from '@/lib/plan/schema';
import type { SlideRole } from '@/lib/slidedoc/doc';
import type { Layer } from '@/lib/slidedoc/layers';
import type { AspectRatio } from '@/lib/slidedoc/primitives';

/**
 * 템플릿 시스템.
 *
 * 설계 판단: 내장 템플릿은 **코드(빌더 함수)**로, 사용자 저장 템플릿은 **슬롯화된 SlideDoc(JSON)**으로 둔다.
 *
 * 왜 내장은 코드인가:
 *  - 오버레이 방향, 텍스트 색 반전, 안전영역 보정 같은 결정을 배경 휘도에 따라 내려야 한다.
 *    순수 데이터로는 이런 조건 분기를 표현할 수 없다.
 *  - 비율마다 미세 조정이 필요한 곳(9:16은 여백을 더 주는 등)을 함수로 처리할 수 있다.
 *
 * 왜 5개 비율 변형을 따로 만들지 않는가:
 *  - LayoutBox가 제약 기반(anchor + 비율 오프셋)이므로 한 정의가 5개 비율에 자동 적응한다.
 *    이것이 Phase 0에서 앵커 좌표계를 택한 이유이고, 실제로 검증됐다.
 *  - 자동 적응이 깨지는 경우에만 ratioOverrides로 예외를 둔다.
 */

/** 브랜드 킷에서 조판에 필요한 부분만 추린 형태. */
export type BrandStyle = {
  /** 배경/강조/텍스트 색. 없으면 템플릿 기본값을 쓴다. */
  palette: {
    background?: string;
    accent?: string;
    text?: string;
    textMuted?: string;
  };
  typography: {
    headingFamily?: string;
    headingWeight?: number;
    bodyFamily?: string;
    bodyWeight?: number;
  };
  logo?: { src: string; assetId: string | null } | null;
};

export const DEFAULT_BRAND_STYLE: BrandStyle = {
  palette: {},
  typography: {},
  logo: null,
};

export type LumaBand = {
  meanLuma: number;
  stdDev: number;
  /** 90번째 백분위. 흰 글씨의 최악 케이스(가장 밝은 부분). */
  p90Luma?: number;
  /** 10번째 백분위. 어두운 글씨의 최악 케이스. */
  p10Luma?: number;
};

/** 세로 3분할 밴드별 휘도. sharp 실측 결과. */
export type LumaBands = {
  top: LumaBand;
  middle: LumaBand;
  bottom: LumaBand;
  overall: LumaBand;
};

/** 조판 시점에 확정된 이미지 정보. */
export type ResolvedImage = {
  src: string;
  assetId: string | null;
  /**
   * 기본 휘도 0~1. bands가 없을 때 쓰는 폴백이다.
   * 실측 전이면 무드로부터 추정한 값을 쓴다(estimateLumaFromMood).
   */
  meanLuma: number;
  stdDev: number;
  /**
   * 밴드별 실측 휘도.
   *
   * 있으면 **템플릿이 자기 텍스트 위치의 밴드를 골라 쓴다.**
   * 이게 없으면 중앙 정렬 템플릿에 하단 휘도를 적용하는 식의 불일치가 생겨
   * 오버레이가 부족하거나 과하게 들어간다.
   */
  bands?: LumaBands;
  /** 피사체 초점. 얼굴 검출 결과가 있으면 반영한다. */
  focus?: { x: number; y: number };
};

/** 텍스트가 놓이는 세로 위치. 템플릿이 자기 레이아웃에 맞게 선언한다. */
export type TextRegion = 'top' | 'middle' | 'bottom' | 'full';

/** 이미지에서 해당 영역의 휘도를 꺼낸다. bands가 없으면 폴백값을 쓴다. */
export function lumaForRegion(image: ResolvedImage, region: TextRegion): LumaBand {
  if (!image.bands) {
    return { meanLuma: image.meanLuma, stdDev: image.stdDev };
  }
  if (region === 'full') {
    return image.bands.overall;
  }
  return image.bands[region];
}

/**
 * 가독성 판단용 휘도.
 *
 * 평균이 아니라 **최악 케이스 백분위**를 쓴다.
 * 어두운 배경에 밝은 피사체가 있으면(어두운 나무 위 황금색 타르트 등)
 * 평균은 "어둡다"고 판단해 흰 글씨를 고르는데, 실제로는 밝은 부분과 겹쳐 안 읽힌다.
 *
 * 어두운 배경(흰 글씨 예정)이면 p90(가장 밝은 쪽)을,
 * 밝은 배경(어두운 글씨 예정)이면 p10(가장 어두운 쪽)을 본다.
 */
export function readabilityLuma(band: LumaBand): {
  meanLuma: number;
  stdDev: number;
  worstCaseLuma?: number;
} {
  const willUseLightText = band.meanLuma < 0.5;
  const worstCase = willUseLightText ? band.p90Luma : band.p10Luma;

  // 평균은 그대로 넘긴다 — 글자색 결정에 쓰인다.
  // 최악값은 별도 필드로 넘겨 오버레이 세기에만 반영된다.
  return {
    meanLuma: band.meanLuma,
    stdDev: band.stdDev,
    ...(worstCase !== undefined ? { worstCaseLuma: worstCase } : {}),
  };
}

export type BuildContext = {
  plan: SlidePlan;
  ratio: AspectRatio;
  /** 논리 캔버스 크기 (base 1080 기준) */
  canvas: { width: number; height: number };
  brand: BrandStyle;
  /** 배경 이미지. null이면 단색/그라데이션 배경 템플릿으로 동작한다. */
  image: ResolvedImage | null;
  /** 슬라이드 번호 표시용 (1-based). null이면 표시하지 않는다. */
  pageLabel: string | null;
};

export type BuildResult = {
  layers: Layer[];
  /** 캔버스 배경 (이미지가 없을 때 쓰임) */
  background: { kind: 'solid'; color: string };
  /** 안전영역 오버라이드. 없으면 문서 기본값. */
  safeArea?: { top: number; right: number; bottom: number; left: number };
  /**
   * 수직 스택 선언. 있으면 조판 엔진이 실측 높이로 y를 다시 계산한다.
   * 템플릿이 y를 직접 고정하면 짧은 캔버스(1:1, 16:9)에서 레이어가 겹친다.
   */
  stack?: StackSpec;
  /**
   * 스택 뒤에 깔 배경 판(카드). 스택 높이가 확정된 뒤 생성되므로
   * 카피 길이에 맞춰 카드 높이가 자동으로 맞는다.
   */
  backdrop?: BackdropSpec;
};

export type StackSpec = {
  from: 'bottom' | 'top' | 'middle';
  order: string[];
  start: number;
  gap: number;
};

export type BackdropSpec = {
  id: string;
  color: string;
  radius: number;
  /** 좌측 오프셋 (캔버스 폭 비율) */
  x: number;
  /** 폭 (캔버스 폭 비율) */
  w: number;
  /** 하단 오프셋 (캔버스 높이 비율) */
  bottom: number;
  /** 스택 위아래 여백 (캔버스 높이 비율) */
  paddingY: number;
};

export type Template = {
  id: string;
  name: string;
  /** 이 템플릿이 어울리는 슬라이드 역할 */
  roles: readonly SlideRole[];
  /** 배경 이미지가 필수인지. false면 단색 배경으로도 동작한다. */
  requiresImage: boolean;
  /**
   * 시각적 성격 — 밴딧이 탐색할 때 비슷한 것만 고르지 않도록 다양성을 확보한다.
   * 'editorial' 잡지형 / 'bold' 대형 타이포 / 'minimal' 여백 중심 / 'card' 카드 레이어
   */
  vibe: 'editorial' | 'bold' | 'minimal' | 'card';
  build: (context: BuildContext) => BuildResult;
};

/**
 * 무드로부터 배경 휘도를 추정한다.
 *
 * 스톡 이미지를 실제로 받아 sharp로 재기 전에는 휘도를 모른다.
 * 그런데 조판을 이미지 도착까지 기다리면 첫 슬라이드 표시가 늦어진다.
 * 그래서 무드로 추정해 먼저 조판하고, 실측값이 오면 오버레이만 갱신한다.
 */
export function estimateLumaFromMood(mood: ImageMood): number {
  switch (mood) {
    case 'dark': {
      return 0.18;
    }
    case 'cool': {
      return 0.45;
    }
    case 'warm': {
      return 0.55;
    }
    case 'neutral': {
      return 0.5;
    }
    case 'bright': {
      return 0.82;
    }
  }
}

/** 비율이 가로형(폭 > 높이)인지. 가로형은 텍스트 블록을 좁게 잡아야 읽힌다. */
export function isLandscape(ratio: AspectRatio): boolean {
  return ratio === '16:9';
}

/** 비율이 세로로 매우 긴지(9:16). 여백을 더 주고 텍스트를 아래쪽에 모은다. */
export function isTallPortrait(ratio: AspectRatio): boolean {
  return ratio === '9:16';
}
