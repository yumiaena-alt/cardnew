import { eq } from 'drizzle-orm';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { renderVideo } from '@/libs/RenderService';
import { createSignedUrl, deckVideoPath, RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import { deckVersions } from '@/models/Deck';
import { findDeckDetail } from './repository';

/**
 * Turning a deck into a reel.
 *
 * The cards are already rendered, so the video is a stitching job rather than a
 * generation one: no model, no per-second price, and what comes out is the deck
 * the user approved rather than something adjacent to it.
 *
 * Not charged. Nothing new is produced — the pixels were paid for when the deck
 * was generated — and putting a price on re-encoding what a user already owns
 * would be charging for the format, not the work.
 */

export type VideoOutcome =
  | { ok: true; url: string }
  | { ok: false; reason: 'not_found' | 'no_rendered_cards' | 'unavailable' };

/**
 * Fetches one stored card.
 *
 * @param path - The object path inside the render bucket.
 * @returns The bytes, or null when the object cannot be read.
 */
async function downloadCard(path: string): Promise<ArrayBuffer | null> {
  const url = await createSignedUrl(RENDER_BUCKET, path);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(() => null);

  return response?.ok ? await response.arrayBuffer() : null;
}

/**
 * Builds the deck's reel and stores it.
 *
 * Rebuilding overwrites the previous file at the same path. A deck whose copy
 * was edited after the first build would otherwise keep serving the old video,
 * which is worse than spending the encode again.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param deckId - The deck to stitch.
 * @returns A signed URL for the video, or why it could not be built.
 */
export async function buildDeckVideo(scope: OrgScope, deckId: string): Promise<VideoOutcome> {
  const detail = await findDeckDetail(scope, deckId);

  if (!(detail && detail.deck.activeVersionId)) {
    return { ok: false, reason: 'not_found' };
  }

  const paths = detail.panels
    .map((panel) => panel.renderPath)
    .filter((path): path is string => path !== null);

  if (paths.length === 0) {
    return { ok: false, reason: 'no_rendered_cards' };
  }

  const versionId = detail.deck.activeVersionId;

  try {
    const cards = await Promise.all(paths.map(async (path) => await downloadCard(path)));
    const images = cards.filter((card): card is ArrayBuffer => card !== null);

    if (images.length === 0) {
      return { ok: false, reason: 'no_rendered_cards' };
    }

    const video = await renderVideo(images);
    const path = deckVideoPath({ orgId: scope.orgId, versionId });

    await uploadObject({
      bucket: RENDER_BUCKET,
      path,
      body: video.bytes,
      contentType: 'video/mp4',
    });

    // Written on the version, not the deck: a repaint makes a new version, and
    // its video is a different file from the one the previous version had.
    await db.update(deckVersions).set({ videoPath: path }).where(eq(deckVersions.id, versionId));

    logger.info('Deck video built', {
      orgId: scope.orgId,
      deckId,
      seconds: video.durationSeconds,
    });

    return { ok: true, url: await createSignedUrl(RENDER_BUCKET, path) };
  } catch (error) {
    // The render host or storage being down is the ordinary failure here, and
    // neither is something the reader can act on beyond trying later.
    logger.warn('Deck video could not be built', {
      deckId,
      reason: error instanceof Error ? error.message : 'unknown',
    });

    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Reads the stored reel of a deck's active version, when there is one.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param deckId - The deck.
 * @returns A signed URL, or null when no video has been built.
 */
export async function findDeckVideoUrl(scope: OrgScope, deckId: string): Promise<string | null> {
  const detail = await findDeckDetail(scope, deckId);

  if (!detail?.deck.activeVersionId) {
    return null;
  }

  const [version] = await db
    .select({ videoPath: deckVersions.videoPath })
    .from(deckVersions)
    .where(eq(deckVersions.id, detail.deck.activeVersionId))
    .limit(1);

  if (!version?.videoPath) {
    return null;
  }

  return await createSignedUrl(RENDER_BUCKET, version.videoPath).catch(() => null);
}
