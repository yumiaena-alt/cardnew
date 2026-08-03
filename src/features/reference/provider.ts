import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

/**
 * Reference search against the public ad library.
 *
 * The source is Meta's Ad Library, which is a transparency product with an
 * official API: ads that ran publicly, retrieved through the documented
 * endpoint. Nothing here scrapes a page or reads anything a competitor did not
 * publish, which is what keeps this a research tool rather than a liability.
 *
 * Only the fields a reference needs are kept. The API returns targeting and
 * spend ranges for political ads, and holding data we have no use for is a
 * privacy cost with no product benefit.
 */

const GRAPH_ENDPOINT = 'https://graph.facebook.com/v21.0/ads_archive';
const SEARCH_TIMEOUT_MS = 20_000;

/** Countries a reference search covers. Korea first: it is who the product is for. */
const REACHED_COUNTRIES = 'KR';

type ReferenceKind = 'ad' | 'viral';

export type Reference = {
  id: string;
  /** The ad's own copy. The reason a reference is useful at all. */
  body: string;
  pageName: string;
  /** Where the original can be seen. Always linked, never re-hosted. */
  snapshotUrl: string;
  startedAt: string | null;
  platforms: string[];
};

export type ReferenceSearchInput = {
  query: string;
  kind: ReferenceKind;
  /** How far back to look, in days. */
  windowDays: number;
  limit: number;
};

/**
 * Whether reference search can run at all.
 *
 * @returns True when an ad library token is configured.
 */
export function isReferenceSearchConfigured(): boolean {
  return Boolean(Env.META_AD_LIBRARY_TOKEN);
}

/**
 * Reads one archive entry, dropping anything without usable copy.
 *
 * @param entry - A raw record from the API.
 * @returns The reference, or null when it carries nothing to learn from.
 */
function toReference(entry: unknown): Reference | null {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  // Indexed through a Record type rather than asserted: the API is external and
  // every field below is checked before it is used.
  const record: Record<string, unknown> = { ...entry };
  const id = typeof record.id === 'string' ? record.id : null;
  const bodies = record.ad_creative_bodies;
  const firstBody = Array.isArray(bodies) && typeof bodies[0] === 'string' ? bodies[0] : '';

  if (!id || firstBody.trim() === '') {
    return null;
  }

  return {
    id,
    body: firstBody,
    pageName: typeof record.page_name === 'string' ? record.page_name : '',
    snapshotUrl: typeof record.ad_snapshot_url === 'string' ? record.ad_snapshot_url : '',
    startedAt:
      typeof record.ad_delivery_start_time === 'string' ? record.ad_delivery_start_time : null,
    platforms: Array.isArray(record.publisher_platforms)
      ? record.publisher_platforms.filter((value): value is string => typeof value === 'string')
      : [],
  };
}

/**
 * Searches the ad library.
 *
 * @param input - Query, kind, window, and how many results to return.
 * @returns The references found, newest first as the API returns them.
 * @throws Error when the search is unconfigured or the API rejects the request.
 */
export async function searchReferences(input: ReferenceSearchInput): Promise<Reference[]> {
  if (!Env.META_AD_LIBRARY_TOKEN) {
    throw new Error('Reference search is not configured');
  }

  const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    access_token: Env.META_AD_LIBRARY_TOKEN,
    search_terms: input.query,
    ad_reached_countries: REACHED_COUNTRIES,
    ad_active_status: 'ALL',
    ad_delivery_date_min: since.toISOString().slice(0, 10),
    limit: String(input.limit),
    fields: [
      'id',
      'page_name',
      'ad_creative_bodies',
      'ad_snapshot_url',
      'ad_delivery_start_time',
      'publisher_platforms',
    ].join(','),
  });

  const response = await fetch(`${GRAPH_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    logger.warn('Ad library search failed', { status: response.status });

    throw new Error(`Ad library responded ${response.status}`);
  }

  const payload: unknown = await response.json();
  const data =
    typeof payload === 'object' && payload !== null && 'data' in payload ? payload.data : null;

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(toReference).filter((reference): reference is Reference => reference !== null);
}
