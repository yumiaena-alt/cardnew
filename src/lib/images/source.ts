import sharp from 'sharp';
import type { ImageMood, SlidePlan } from '@/lib/plan/schema';
import { analyzeLuma, bandForRegion } from './analyze';
import type { LumaAnalysis, TextRegion } from './analyze';
import type { ImageCandidate, ImageProvider, ProvenanceRecord } from './providers/types';
import { orientationForRatio } from './providers/types';

/**
 * 이미지 조달 오케스트레이터 (Stage 2).
 *
 * 파이프라인: 검색 → 재랭킹 → 다운로드 → 전처리 → 휘도 분석 → SourcedImage.
 *
 * 재랭킹이 필요한 이유: 스톡 API의 첫 결과가 항상 최선은 아니다.
 * 무드 일치·종횡비·설명 관련성을 보고 다시 정렬하면 체감 품질이 눈에 띄게 오른다.
 */

export type SourcedImage = {
  /** 처리된 이미지 (JPEG). R2 업로드 대상. */
  buffer: Buffer;
  /** data URI. 개발·미리보기용. 프로덕션은 R2 URL을 쓴다. */
  dataUri: string;
  format: 'jpeg';
  width: number;
  height: number;
  bytes: number;
  analysis: LumaAnalysis;
  provenance: ProvenanceRecord;
  /** 원본 후보 (재시도·교체용) */
  candidate: ImageCandidate;
};

export type SourceOptions = {
  plan: SlidePlan;
  ratio: string;
  /** 텍스트가 놓일 영역. 템플릿이 알려준다. */
  textRegion?: TextRegion;
  /** 후보 개수 */
  candidates?: number;
  /** 다운로드 타임아웃 (ms) */
  timeoutMs?: number;
};

export class ImageSourcingError extends Error {
  constructor(
    message: string,
    readonly stage: 'search' | 'download' | 'process',
  ) {
    super(message);
    this.name = 'ImageSourcingError';
  }
}

/** 조달 결과. 실패해도 전체 생성을 막지 않도록 null을 허용한다. */
export type SourceResult =
  | { ok: true; image: SourcedImage }
  | { ok: false; reason: string; stage: string };

export async function sourceImage(
  provider: ImageProvider,
  options: SourceOptions,
): Promise<SourceResult> {
  try {
    const candidates = await provider.search({
      query: options.plan.imageQuery,
      mood: options.plan.imageMood,
      orientation: orientationForRatio(options.ratio),
      limit: options.candidates ?? 8,
    });

    if (candidates.length === 0) {
      return { ok: false, reason: '검색 결과 없음', stage: 'search' };
    }

    const ranked = rerank(candidates, options.plan, options.ratio);

    // 상위 후보부터 시도한다. 다운로드가 실패하는 URL이 간혹 있다.
    for (const candidate of ranked.slice(0, 3)) {
      try {
        const image = await downloadAndProcess(provider, candidate, options);
        // Unsplash 이용약관상 의무. 실패해도 무시한다.
        await provider.reportUsage?.(candidate);
        return { ok: true, image };
      } catch {
        continue;
      }
    }

    return { ok: false, reason: '후보 3개 모두 다운로드 실패', stage: 'download' };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : '알 수 없는 오류',
      stage: 'search',
    };
  }
}

async function downloadAndProcess(
  _provider: ImageProvider,
  candidate: ImageCandidate,
  options: SourceOptions,
): Promise<SourcedImage> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? 12_000);

  let raw: ArrayBuffer;
  try {
    const response = await fetch(candidate.url, { signal: controller.signal });
    if (!response.ok) {
      throw new ImageSourcingError(`다운로드 ${response.status}`, 'download');
    }
    raw = await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }

  const input = Buffer.from(raw);

  // 휘도 분석은 전처리 **전** 원본으로 한다.
  // 리사이즈·크롭 후에 재면 실제 렌더될 영역과 달라질 수 있다.
  const analysis = await analyzeLuma(input);

  /**
   * 전처리: 카드뉴스에 필요한 크기로 맞추고 JPEG로 변환한다.
   *
   * 1080px 폭이면 Instagram 권장 해상도를 충족한다. 그 이상은 파일만 커진다.
   * mozjpeg는 같은 품질에서 파일이 10~15% 작다 — 발행 시 업로드가 빨라진다.
   */
  const processed = await sharp(input)
    .resize(1080, 1350, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    dataUri: `data:image/jpeg;base64,${processed.data.toString('base64')}`,
    format: 'jpeg',
    width: processed.info.width,
    height: processed.info.height,
    bytes: processed.data.byteLength,
    analysis,
    provenance: _provider.provenanceFor(candidate),
    candidate,
  };
}

/**
 * 후보 재랭킹.
 *
 * 점수 요소:
 *  1) 종횡비 일치 — 세로 캔버스에 가로 사진을 넣으면 크게 잘려 의도한 피사체가 사라진다
 *  2) 무드 일치 — 지배색으로 추정
 *  3) 설명 관련성 — 검색어 단어가 설명에 실제로 있는지
 *  4) 해상도 — 너무 작으면 확대 시 깨진다
 */
export function rerank(
  candidates: ImageCandidate[],
  plan: SlidePlan,
  ratio: string,
): ImageCandidate[] {
  const targetAspect = aspectValue(ratio);
  const queryWords = plan.imageQuery
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 3);

  const scored = candidates.map((candidate, index) => {
    let score = 0;

    // 1) 종횡비 (가장 중요 — 잘림은 되돌릴 수 없다)
    const candidateAspect = candidate.width / candidate.height;
    const aspectDiff = Math.abs(candidateAspect - targetAspect) / targetAspect;
    score += Math.max(0, 1 - aspectDiff) * 3;

    // 2) 무드
    if (candidate.dominantColor) {
      score += moodMatch(candidate.dominantColor, plan.imageMood) * 2;
    }

    // 3) 설명 관련성
    const description = (candidate.description ?? '').toLowerCase();
    const matched = queryWords.filter((w) => description.includes(w)).length;
    score += queryWords.length > 0 ? (matched / queryWords.length) * 1.5 : 0;

    // 4) 해상도 (1080 폭 이상이면 만점)
    score += Math.min(1, candidate.width / 1080);

    // 동점일 때 원래 순서를 존중한다 — 스톡 API의 관련도 정렬도 정보다.
    score -= index * 0.001;

    return { candidate, score };
  });

  return scored.toSorted((a, b) => b.score - a.score).map((s) => s.candidate);
}

function aspectValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) {
    return 0.8;
  }
  return w / h;
}

/**
 * 지배색이 무드와 얼마나 맞는지 0~1.
 *
 * 정확한 색 심리 분석이 아니라 명백한 불일치를 걸러내는 목적이다.
 * (dark 무드에 흰 배경 사진이 1순위로 오는 것을 막는다)
 */
export function moodMatch(hexColor: string, mood: ImageMood): number {
  const raw = hexColor.replace('#', '');
  if (raw.length < 6) {
    return 0.5;
  }

  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;

  const brightness = (r + g + b) / 3;
  // 따뜻함: 빨강/노랑이 파랑보다 강한 정도
  const warmth = (r + g / 2) / 2 - b;

  switch (mood) {
    case 'dark': {
      return 1 - brightness;
    }
    case 'bright': {
      return brightness;
    }
    case 'warm': {
      return clamp01(0.5 + warmth);
    }
    case 'cool': {
      return clamp01(0.5 - warmth);
    }
    case 'neutral': {
      /**
       * 중간 밝기 + 낮은 색편향을 선호한다.
       * 두 벌점을 그냥 빼면 음수가 나올 수 있어(예: 순수 파랑) clamp가 필요하다.
       * 벌점 가중치를 나눠 어느 한쪽이 점수를 혼자 무너뜨리지 않게 한다.
       */
      const brightnessPenalty = Math.abs(brightness - 0.5) * 2;
      const colorPenalty = Math.min(1, Math.abs(warmth) * 2);
      return clamp01(1 - brightnessPenalty * 0.5 - colorPenalty * 0.5);
    }
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * SourcedImage → 조판 엔진이 쓰는 ResolvedImage 형태.
 *
 * 여기서 텍스트 영역에 맞는 밴드를 골라 단일 휘도값으로 만든다.
 * 이 변환이 "실측 휘도 → 자동 오버레이"(차별점 #2)를 완성하는 지점이다.
 */
export function toResolvedImage(
  image: SourcedImage,
  options: { assetId?: string | null; textRegion?: TextRegion; src?: string } = {},
): {
  src: string;
  assetId: string | null;
  meanLuma: number;
  stdDev: number;
  bands: {
    top: { meanLuma: number; stdDev: number };
    middle: { meanLuma: number; stdDev: number };
    bottom: { meanLuma: number; stdDev: number };
    overall: { meanLuma: number; stdDev: number };
  };
} {
  // 폴백용 단일 값. bands가 있으면 템플릿이 자기 영역 값을 골라 쓴다.
  const fallback = bandForRegion(image.analysis, options.textRegion ?? 'bottom');

  return {
    src: options.src ?? image.dataUri,
    assetId: options.assetId ?? null,
    meanLuma: fallback.meanLuma,
    stdDev: fallback.stdDev,
    /**
     * 밴드 전체를 넘긴다.
     *
     * 조달 시점에는 어떤 템플릿이 선택될지 모른다(템플릿 선택은 조판에서 일어난다).
     * 그래서 단일 값만 넘기면 중앙 정렬 템플릿에 하단 휘도가 적용되는 불일치가 생긴다.
     * 밴드를 다 넘기고 템플릿이 고르게 하는 것이 올바른 책임 분리다.
     */
    bands: {
      top: image.analysis.top,
      middle: image.analysis.middle,
      bottom: image.analysis.bottom,
      overall: image.analysis.overall,
    },
  };
}
