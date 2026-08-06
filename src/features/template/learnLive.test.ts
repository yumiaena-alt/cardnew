import { like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { createSignedUrl, RENDER_BUCKET } from '@/libs/Storage';
import { panels } from '@/models/Deck';
import { learnDesign } from './learn';

/**
 * Design learning, against the real model.
 *
 * Uses cards this project made as its references, so the test does not need
 * anyone else's design to prove the extraction works.
 *
 * Skipped unless `RUN_LIVE_PIPELINE=1`. It spends real provider quota.
 */

const LIVE = process.env.RUN_LIVE_PIPELINE === '1';
const REFERENCE_COUNT = 3;

describe.skipIf(!LIVE)('design learning, live', () => {
  it('reads layout boxes and colours out of reference cards', async () => {
    const rows = await db
      .select({ renderPath: panels.renderPath })
      .from(panels)
      // JPEG only. The PNG cards this project made before the format changed
      // run to ten megabytes each, over the provider's per-image ceiling.
      .where(like(panels.renderPath, '%.jpg'))
      .limit(REFERENCE_COUNT);

    const images = await Promise.all(
      rows.map(async (row) => {
        const url = await createSignedUrl(RENDER_BUCKET, row.renderPath ?? '');
        const response = await fetch(url);
        const bytes = Buffer.from(await response.arrayBuffer());

        return `data:image/jpeg;base64,${bytes.toString('base64')}`;
      }),
    );

    const learned = await learnDesign({ images, ratio: '4:5', instruction: null });

    // biome-ignore lint/suspicious/noConsole: this harness reports to a person
    console.log(
      '  layouts:',
      learned.layouts.map((l) => `${l.role}(${l.slots.map((s) => s.key).join(',')})`).join(' · '),
    );
    // biome-ignore lint/suspicious/noConsole: this harness reports to a person
    console.log('  tokens :', JSON.stringify(learned.tokens));

    expect(learned.layouts.length).toBeGreaterThan(0);

    // Boxes outside the canvas are the failure that matters: they compose
    // into cards with content off the edge, which renders without complaint.
    for (const layout of learned.layouts) {
      for (const slot of layout.slots) {
        expect(slot.box.x + slot.box.w).toBeLessThanOrEqual(1.001);
        expect(slot.box.y + slot.box.h).toBeLessThanOrEqual(1.001);
      }
    }
  }, 600_000);
});
