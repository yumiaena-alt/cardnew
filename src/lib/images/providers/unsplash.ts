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

  async search(options: SearchOptions): Promise<ImageCandidate[]> {
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
