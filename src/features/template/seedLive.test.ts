import { like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/libs/DB';
import { createSignedUrl, RENDER_BUCKET } from '@/libs/Storage';
import { panels } from '@/models/Deck';
import { learnDesign } from './learn';
import { saveLearnedTemplate } from './repository';

/**
 * Puts a learned template in the database so the gallery has something to show.
 *
 * Skipped unless `RUN_LIVE_PIPELINE=1`. It spends real provider quota.
 */

const LIVE = process.env.RUN_LIVE_PIPELINE === '1';
const ORG_ID = '00000000-0000-4000-8000-000000000001';
const REFERENCE_COUNT = 3;

describe.skipIf(!LIVE)('learned template, seeded', () => {
  it('saves a template the gallery can list', async () => {
    const rows = await db
      .select({ renderPath: panels.renderPath })
      .from(panels)
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
    const templateId = await saveLearnedTemplate(
      { orgId: ORG_ID },
      {
        name: '여름 카페 스타일',
        ratio: '4:5',
        layouts: learned.layouts,
        tokens: learned.tokens,
        instruction: null,
        imageCount: images.length,
      },
    );

    // biome-ignore lint/suspicious/noConsole: this harness reports to a person
    console.log('  template:', templateId);

    expect(templateId).toBeTruthy();
  }, 600_000);
});
