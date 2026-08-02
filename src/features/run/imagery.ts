import { UnsplashProvider } from '@/lib/images/providers/unsplash';
import { sourceImage, toResolvedImage } from '@/lib/images/source';
import type { CardnewsPlan } from '@/lib/plan/schema';
import type { ResolvedImage } from '@/lib/renderer/types';
import { logger } from '@/libs/Logger';
import type { SlotProvenance } from '@/models/Deck';

/**
 * Stock photography for a planned deck.
 *
 * Sourcing never fails a run. A card with no photo is a card that still says
 * what it needs to say, whereas aborting the batch because one search came back
 * empty would refund work the user could have used. Failures come back as nulls
 * and the layout engine falls back to a text-only treatment.
 */

export type SlideImagery = {
  /** Positional, aligned to `plan.slides`. Null where sourcing failed. */
  images: (ResolvedImage | null)[];
  provenance: (SlotProvenance | null)[];
};

/**
 * Sources one photo per planned slide.
 *
 * The image is passed to the renderer as a data URI rather than a URL. The
 * renderer runs in a browser on another host and the storage bucket is private,
 * so a link would need a signed URL round trip per panel to render something
 * that is already in memory here.
 *
 * @param plan - The planned deck.
 * @param ratio - Aspect ratio the cards render at.
 * @returns Images and provenance, positionally aligned to the plan's slides.
 */
export async function sourceImagery(plan: CardnewsPlan, ratio: string): Promise<SlideImagery> {
  const provider = new UnsplashProvider();

  if (!provider.isAvailable()) {
    logger.warn('Stock provider unavailable, composing without photography');

    return { images: plan.slides.map(() => null), provenance: plan.slides.map(() => null) };
  }

  const images: (ResolvedImage | null)[] = [];
  const provenance: (SlotProvenance | null)[] = [];

  for (const slide of plan.slides) {
    const result = await sourceImage(provider, { plan: slide, ratio });

    if (!result.ok) {
      logger.warn('Image sourcing failed', { query: slide.imageQuery, reason: result.reason });

      images.push(null);
      provenance.push(null);

      continue;
    }

    images.push(toResolvedImage(result.image, { src: result.image.dataUri }));
    provenance.push(result.image.provenance);
  }

  return { images, provenance };
}
