import { Env } from '@/libs/Env';
import type { ImageCandidate, ImageProvider, ProvenanceRecord, SearchOptions } from './types';

/**
 * Unsplash 어댑터.
 *
 * ⚠️ 이용약관 준수 사항 (착수 전 최신 문서 재확인 필요):
 *  1) 사진가 이름·링크 표기 (attribution)
 *  2) 사진을 실제로 사용할 때 download_location 트리거 호출 — 통계 목적이며 의무다.
 *     이걸 빠뜨리면 프로덕션 승인이 거절될 수 있다.
 *  3) 사진을 그대로 재배포하는 서비스는 금지. 우리는 카드뉴스로 합성하므로 해당 없음.
 */

const API_BASE = 'https://api.unsplash.com';

/**
 * 검색어에서 떨어내도 뜻이 남는 단어들. 이것만으로는 사진을 못 찾는다.
 */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'on',
  'at',
  'of',
  'with',
  'and',
  'or',
  'to',
  'for',
  'from',
  'by',
  'over',
  'under',
  'into',
  'up',
  'down',
  'out',
]);

/** 좁혀 들어갈 때 남길 핵심 단어 수. 셋을 넘으면 다시 0건으로 돌아간다. */
const KEYWORD_LIMIT = 3;

/**
 * 검색어를 넓은 쪽으로 단계적으로 푼다.
 *
 * 기획 모델은 이미지 지시를 문장으로 쓴다 — "person looking tired in summer
 * heat, fanning with hand, soft window light" 같은 식이다. Unsplash 검색은 이런
 * 문장에 0건을 돌려준다. 같은 소재도 "person tired summer" 로 물으면 수천 건이
 * 나온다. 그래서 실패를 사진 없음으로 받아들이기 전에 스스로 좁혀 본다.
 *
 * @param query - 기획이 준 원본 지시.
 * @returns 넓은 쪽으로 갈수록 뒤에 오는 검색어들. 중복은 제거된다.
 */
export function narrowQueries(query: string): string[] {
  const full = query.trim();

  if (full === '') {
    return [];
  }

  // 첫 쉼표 앞이 주제고 뒤는 대개 조명·구도 같은 수식이다.
  const subject = (full.split(',')[0] ?? '').trim();

  const keywords = subject
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/u)
    .filter((word) => word !== '' && !STOP_WORDS.has(word))
    .slice(0, KEYWORD_LIMIT)
    .join(' ');

  return [...new Set([full, subject, keywords])].filter((entry) => entry !== '');
}

type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  color: string | null;
  description: string | null;
  alt_description: string | null;
  urls: { raw: string; full: string; regular: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
};

export class UnsplashProvider implements ImageProvider {
  readonly id = 'unsplash' as const;
  readonly #accessKey: string | undefined;
  /** 사용 보고에 필요한 URL을 후보 id로 보관한다 (ImageCandidate에 넣기엔 내부 구현 세부) */
  readonly #downloadLocations = new Map<string, string>();

  constructor(accessKey?: string) {
    // Env validates and narrows; reading process.env directly is not allowed here.
    this.#accessKey = accessKey ?? Env.UNSPLASH_ACCESS_KEY;
  }

  isAvailable(): boolean {
    return Boolean(this.#accessKey);
  }

  /**
   * 기획이 준 지시로 사진을 찾는다.
   *
   * 한 번 물어보고 마는 대신 검색어를 넓혀 가며 다시 묻는다. 문장으로 된 지시에
   * Unsplash 가 0건을 돌려주는 것이 흔한데, 그걸 "사진 없음"으로 받아들이면
   * 대부분의 카드가 사진 없이 나간다.
   *
   * @param options - 검색어, 방향, 개수.
   * @returns 후보들. 어떤 검색어로도 못 찾으면 빈 배열.
   */
  async search(options: SearchOptions): Promise<ImageCandidate[]> {
    for (const query of narrowQueries(options.query)) {
      const found = await this.#searchOnce({ ...options, query });

      if (found.length > 0) {
        return found;
      }
    }

    return [];
  }

  async #searchOnce(options: SearchOptions): Promise<ImageCandidate[]> {
    if (!this.#accessKey) {
      throw new Error('UNSPLASH_ACCESS_KEY가 없습니다');
    }

    const params = new URLSearchParams({
      query: options.query,
      per_page: String(options.limit ?? 8),
      orientation: options.orientation,
      // 사진만. 일러스트가 섞이면 브랜드 톤이 흔들린다.
      content_filter: 'high',
    });

    const response = await fetch(`${API_BASE}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${this.#accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      // rate limit(403)과 인증 실패(401)를 구분해 알린다 — 대응이 다르다.
      const hint =
        response.status === 403
          ? ' (rate limit 소진 가능 — 시간당 50회 제한)'
          : response.status === 401
            ? ' (Access Key 확인 필요)'
            : '';
      throw new Error(`Unsplash 검색 실패: ${response.status}${hint}`);
    }

    const body = (await response.json()) as { results: UnsplashPhoto[] };

    return body.results.map((photo) => {
      this.#downloadLocations.set(photo.id, photo.links.download_location);
      return {
        // regular(1080px 폭)는 카드뉴스에 충분하다. full은 대역폭만 먹는다.
        url: photo.urls.regular,
        sourceUrl: photo.links.html,
        sourceId: photo.id,
        width: photo.width,
        height: photo.height,
        authorName: photo.user.name,
        authorUrl: photo.user.links.html,
        description: photo.description ?? photo.alt_description,
        dominantColor: photo.color,
      };
    });
  }

  provenanceFor(candidate: ImageCandidate): ProvenanceRecord {
    return {
      source: 'unsplash',
      sourceId: candidate.sourceId,
      sourceUrl: candidate.sourceUrl,
      authorName: candidate.authorName,
      authorUrl: candidate.authorUrl,
      license: 'Unsplash License',
      // Unsplash License는 표기를 의무화하지 않지만 강력히 권장한다.
      // 우리는 라이선스 리포트(차별점 #6)에 항상 넣으므로 true로 둔다.
      attributionRequired: true,
      commercialSafe: true,
    };
  }

  /** 사용 보고. 실패해도 콘텐츠 생성을 막지 않는다 (통계 목적). */
  async reportUsage(candidate: ImageCandidate): Promise<void> {
    const location = this.#downloadLocations.get(candidate.sourceId);
    if (!location || !this.#accessKey) {
      return;
    }

    try {
      await fetch(location, {
        headers: { Authorization: `Client-ID ${this.#accessKey}` },
      });
    } catch {
      // 보고 실패는 무시한다. 사용자 작업을 막을 이유가 없다.
    }
  }
}
