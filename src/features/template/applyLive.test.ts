import { like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { composeCardnews } from '@/lib/renderer/compose';
import { db } from '@/libs/DB';
import { createSignedUrl, RENDER_BUCKET } from '@/libs/Storage';
import { panels } from '@/models/Deck';
import { toBrandStyle } from './brand';
import { learnDesign } from './learn';

/**
 * A learned design reaching the cards it was learned for.
 *
 * Learning that stopped at the database would be a feature nobody can see. The
 * check is whether the palette it read actually comes out the other end.
 *
 * Skipped unless `RUN_LIVE_PIPELINE=1`. It spends real provider quota.
 */

const LIVE = process.env.RUN_LIVE_PIPELINE === '1';
const REFERENCE_COUNT = 3;

const PLAN = {
  hook: '여름은 잔 안에서 끝난다',
  targetAudience: null,
  slides: [
    {
      role: 'cover' as const,
      headline: '여름은 잔 안에서 끝난다',
      body: '',
      eyebrow: 'NEW',
      imageQuery: 'iced coffee',
      imageMood: 'bright' as const,
      templateHint: null,
    },
  ],
  caption: '',
  hashtags: [],
};

/**
 * The background a composed slide ended up with.
 *
 * @param slide - A composed slide.
 * @returns The colour, or null when the background is not a flat one.
 */
function background(slide: { doc: { canvas: { bg: { kind: string; color?: string } } } }) {
  return slide.doc.canvas.bg.kind === 'solid' ? (slide.doc.canvas.bg.color ?? null) : null;
}

describe.skipIf(!LIVE)('learned design, applied', () => {
  it('composes a card in the palette it learned', async () => {
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
    const brand = toBrandStyle(learned.tokens);

    const withBrand = composeCardnews({ plan: PLAN, ratio: '4:5', brand, seed: 'live' });
    const without = composeCardnews({ plan: PLAN, ratio: '4:5', seed: 'live' });
    const [brandedCover] = withBrand.slides;
    const [plainCover] = without.slides;

    // biome-ignore lint/suspicious/noConsole: this harness reports to a person
    console.log(
      '  learned bg:',
      brand.palette.background,
      '| composed:',
      brandedCover === undefined ? null : background(brandedCover),
    );
    // biome-ignore lint/suspicious/noConsole: this harness reports to a person
    console.log('  default bg:', plainCover === undefined ? null : background(plainCover));

    if (brandedCover === undefined) {
      throw new Error('composed nothing to check');
    }

    expect(brand.palette.background).toBeDefined();
    expect(background(brandedCover)).toBe(brand.palette.background);
  }, 600_000);
});
