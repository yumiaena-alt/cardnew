import type { ImageMood } from '@/lib/plan/schema';

/**
 * 이미지 프로바이더 계약.
 *
 * 어댑터로 분리한 이유: Unsplash/Pexels/fal.ai/유료스톡이 전부 다른 응답 형태를 쓰는데,
 * provenance(출처·라이선스) 기록은 모든 경로에서 동일하게 필요하다.
 * 이 인터페이스가 그 공통 규약이다 — 새 프로바이더를 붙일 때 license 필드를
 * 채우지 않으면 타입 오류가 나서 저작권 추적 누락을 컴파일 시점에 막는다.
 */

export type ImageCandidate = {
  /** 다운로드할 URL */
  url: string;
  /** 원본 페이지 URL (출처 표기용) */
  sourceUrl: string;
  /** 프로바이더 내 고유 id */
  sourceId: string;
  width: number;
  height: number;
  authorName: string | null;
  authorUrl: string | null;
  /** 프로바이더가 준 설명 — 재랭킹에 쓴다 */
  description: string | null;
  /** 지배색 (프로바이더가 제공하면). 휘도 사전 추정에 쓸 수 있다. */
  dominantColor: string | null;
};

export type SearchOptions = {
  query: string;
  mood: ImageMood;
  /** 캔버스 방향에 맞는 사진을 요청한다 */
  orientation: 'portrait' | 'landscape' | 'squarish';
  /** 후보 개수. 많을수록 재랭킹 품질이 오르지만 rate limit을 먹는다. */
  limit?: number;
};

export type ProviderId = 'unsplash' | 'pexels' | 'fal_flux' | 'upload';

export type ProvenanceRecord = {
  source: ProviderId;
  sourceId: string;
  sourceUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  /** 라이선스 식별자 */
  license: string;
  /** 출처 표기가 의무인지 */
  attributionRequired: boolean;
  /** 상업적 사용 안전 여부. false면 발행 파이프라인이 차단한다. */
  commercialSafe: boolean;
};

export type ImageProvider = {
  readonly id: ProviderId;
  /** 이 프로바이더가 쓸 수 있는 상태인지 (키 설정 여부) */
  isAvailable(): boolean;
  search(options: SearchOptions): Promise<ImageCandidate[]>;
  /** 후보로부터 provenance 레코드를 만든다 */
  provenanceFor(candidate: ImageCandidate): ProvenanceRecord;
  /**
   * 사용 보고 (Unsplash는 다운로드 트리거 호출이 API 이용약관상 의무).
   * 없으면 no-op.
   */
  reportUsage?(candidate: ImageCandidate): Promise<void>;
};

/** 비율 → 스톡 검색 orientation */
export function orientationForRatio(ratio: string): SearchOptions['orientation'] {
  if (ratio === '16:9') {
    return 'landscape';
  }
  if (ratio === '1:1') {
    return 'squarish';
  }
  return 'portrait';
}
