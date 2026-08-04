import { desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { decks, deckVersions } from '@/models/Deck';
import { buildDeckVideo, findDeckVideoUrl } from './video';

/**
 * The reel path, end to end, against the real render host and storage.
 *
 * Runs against whatever deck the live generation harness left behind, so the
 * two together cover the whole route from a topic to a downloadable video.
 *
 * Skipped unless `RUN_LIVE_PIPELINE=1`. It spends render time and writes a real
 * object to storage.
 */

const LIVE = process.env.RUN_LIVE_PIPELINE === '1';
const ORG_ID = '00000000-0000-4000-8000-000000000001';
const scope = { orgId: ORG_ID };
const MINUTES = 600_000;

let deckId = '';

describe.skipIf(!LIVE)('reel, live', () => {
  it(
    'stitches the most recent deck into a video',
    async () => {
      const [deck] = await db
        .select({ id: decks.id })
        .from(decks)
        .where(eq(decks.orgId, ORG_ID))
        .orderBy(desc(decks.createdAt))
        .limit(1);

      if (!deck) {
        throw new Error('no deck to stitch — run the generation harness first');
      }

      deckId = deck.id;
      const result = await buildDeckVideo(scope, deckId);

      if (!result.ok) {
        throw new Error(`video build failed: ${result.reason}`);
      }

      const res = await fetch(result.url, { signal: AbortSignal.timeout(60_000) });
      const bytes = Buffer.from(await res.arrayBuffer());

      // biome-ignore lint/suspicious/noConsole: this harness reports to a person
      console.log(`  video: ${res.status} ${(bytes.length / 1024).toFixed(0)}KB`);

      expect(res.ok).toBeTruthy();
      expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
    },
    MINUTES,
  );

  it(
    'records the video on the version so the page finds it again',
    async () => {
      const [deck] = await db
        .select({ versionId: decks.activeVersionId })
        .from(decks)
        .where(eq(decks.id, deckId))
        .limit(1);

      const [version] = await db
        .select({ videoPath: deckVersions.videoPath })
        .from(deckVersions)
        .where(eq(deckVersions.id, deck?.versionId ?? ''))
        .limit(1);

      expect(version?.videoPath).toBeTruthy();
      await expect(findDeckVideoUrl(scope, deckId)).resolves.toContain('reel.mp4');
    },
    MINUTES,
  );
});
