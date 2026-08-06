'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { UnsplashProvider } from '@/lib/images/providers/unsplash';
import { shouldRetranslate, toEnglishQuery } from '@/lib/images/query';
import { logger } from '@/libs/Logger';
import { PANEL_CONTENT_TYPE, renderPanel } from '@/libs/RenderService';
import { RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import type {
  ChooseImageInput,
  SavePanelDocInput,
  SearchImagesInput,
  UpdateSlotInput,
} from '@/validations/DeckValidation';
import {
  chooseImageSchema,
  savePanelDocSchema,
  searchImagesSchema,
  updateSlotSchema,
} from '@/validations/DeckValidation';
import { findOwnedPanel, updatePanelDoc, updatePanelSlots } from './repository';
import { buildDeckVideo } from './video';

/**
 * Server Action for editing generated copy.
 *
 * An edit marks the slot as user-edited, which is what regeneration reads to
 * decide what to leave alone. Without that flag, asking for a fresh version of
 * a card would silently discard the wording the user had just fixed by hand.
 */

/** Same 2x the pipeline renders at, so an edited card matches its neighbours. */
const RENDER_SCALE = 2;

export type UpdateSlotResult = { ok: true } | { ok: false; code: string };

export type BuildVideoResult = { ok: true; url: string } | { ok: false; code: string };

/**
 * Writes one slot's text.
 *
 * The image is not re-rendered here. Re-rendering costs a browser round trip
 * per keystroke-sized change, so the stored copy and the rendered PNG diverge
 * until the panel is regenerated — which is the trade the editing flow makes.
 *
 * @param input - Panel, slot key, and the new text.
 * @returns Success, or a failure code.
 */
export async function updatePanelSlot(input: UpdateSlotInput): Promise<UpdateSlotResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'deck:update');

    const parsed = updateSlotSchema.parse(input);
    const panel = await findOwnedPanel(scope, parsed.panelId);

    if (!panel) {
      return { ok: false, code: 'not_found' };
    }

    const existing = panel.slots[parsed.slotKey];

    if (existing && existing.type !== 'text') {
      return { ok: false, code: 'conflict' };
    }

    await updatePanelSlots(parsed.panelId, {
      ...panel.slots,
      [parsed.slotKey]: {
        ...existing,
        type: 'text',
        value: parsed.value,
        isUserEdited: true,
      },
    });

    logger.info('Panel slot edited', { orgId: scope.orgId, panelId: parsed.panelId });
    revalidatePath('/dashboard/deck');

    return { ok: true };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Slot edit rejected', { code });

    return { ok: false, code };
  }
}

/**
 * Builds the deck's reel.
 *
 * Kicked off by the user rather than produced with every deck: most decks are
 * posted as a carousel and never need a video, and encoding one for each would
 * spend the render host's time on files nobody opens.
 *
 * @param deckId - The deck to stitch.
 * @returns A signed URL for the video, or a failure code.
 */
export async function buildVideo(deckId: string): Promise<BuildVideoResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const result = await buildDeckVideo(scope, deckId);

    if (!result.ok) {
      return { ok: false, code: result.reason };
    }

    revalidatePath(`/dashboard/deck/${deckId}`);

    return { ok: true, url: result.url };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Video build rejected', { code });

    return { ok: false, code };
  }
}

export type SavePanelDocResult = { ok: true } | { ok: false; code: string };

/**
 * Saves a layout edit and redraws the card from it.
 *
 * The image is re-rendered here, unlike a copy edit. A moved layer is a change
 * nobody can see until the card is drawn again, and the published file is the
 * render service's output — leaving the two apart would mean editing something
 * and posting something else.
 *
 * No credits are taken. The card was paid for when it was generated, and this
 * spends a browser screenshot rather than a model call.
 *
 * @param input - Panel and the document it should render from now.
 * @returns Success, or a failure code.
 */
export async function savePanelDoc(input: SavePanelDocInput): Promise<SavePanelDocResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'deck:update');

    const parsed = savePanelDocSchema.parse(input);
    const panel = await findOwnedPanel(scope, parsed.panelId);

    if (!panel) {
      return { ok: false, code: 'not_found' };
    }

    const rendered = await renderPanel(parsed.doc, RENDER_SCALE);

    // Overwrites the card in place. A new path per edit would leave every
    // superseded version behind in storage with nothing pointing at it.
    await uploadObject({
      bucket: RENDER_BUCKET,
      path: panel.renderPath ?? '',
      body: rendered.bytes,
      contentType: PANEL_CONTENT_TYPE,
    });

    await updatePanelDoc(scope, parsed.panelId, parsed.doc);

    logger.info('Panel layout saved', { orgId: scope.orgId, panelId: parsed.panelId });
    revalidatePath('/dashboard/deck');

    return { ok: true };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Panel layout save rejected', { code });

    return { ok: false, code };
  }
}

export type StockImage = {
  url: string;
  thumbnailUrl: string;
  sourceId: string;
  authorName: string | null;
};

export type SearchImagesResult = { ok: true; images: StockImage[] } | { ok: false; code: string };

/** A grid to choose from, not a catalogue to browse. */
const IMAGE_RESULT_LIMIT = 12;

/**
 * Searches, and asks again in English when Korean turns up nothing.
 *
 * Shared by searching and choosing so the second call lands on the same list
 * the user picked from — a choice resolved against a different search would
 * credit a different photographer.
 *
 * @param provider - The stock provider.
 * @param input - Query and orientation.
 * @returns The candidates.
 */
async function searchWithFallback(provider: UnsplashProvider, input: SearchImagesInput) {
  const search = async (query: string) =>
    await provider.search({
      query,
      mood: 'neutral',
      orientation: input.orientation,
      limit: IMAGE_RESULT_LIMIT,
    });

  const first = await search(input.query);

  if (!shouldRetranslate({ query: input.query, resultCount: first.length })) {
    return first;
  }

  const english = await toEnglishQuery(input.query);
  const second = await search(english);

  return second.length > first.length ? second : first;
}

/**
 * Finds replacement photography for a card.
 *
 * Search only. Nothing is recorded until one is chosen, because a search that
 * reported usage would tell the provider a photo was used every time someone
 * typed a different word.
 *
 * @param input - What to search for and the shape it has to fill.
 * @returns Candidates, or a failure code.
 */
export async function searchStockImages(input: SearchImagesInput): Promise<SearchImagesResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'deck:update');

    const parsed = searchImagesSchema.parse(input);
    const provider = new UnsplashProvider();

    if (!provider.isAvailable()) {
      return { ok: false, code: 'provider_unavailable' };
    }

    const candidates = await searchWithFallback(provider, parsed);

    return {
      ok: true,
      images: candidates.map((candidate) => ({
        url: candidate.url,
        thumbnailUrl: candidate.url,
        sourceId: candidate.sourceId,
        authorName: candidate.authorName,
      })),
    };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Image search rejected', { code });

    return { ok: false, code };
  }
}

export type ChooseImageResult = { ok: true } | { ok: false; code: string };

/**
 * Records that a chosen photo is now in use.
 *
 * Separate from saving the card. Unsplash requires a download to be reported
 * when a photo is actually used, not when it is listed, and the attribution
 * shown under the card is read from the panel rather than from the document —
 * so a replacement that only changed the document would keep crediting the
 * photographer whose picture is no longer there.
 *
 * @param input - The panel, the slot, and which photo was picked.
 * @returns Success, or a failure code.
 */
export async function chooseStockImage(input: ChooseImageInput): Promise<ChooseImageResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'deck:update');

    const parsed = chooseImageSchema.parse(input);
    const panel = await findOwnedPanel(scope, parsed.panelId);

    if (!panel) {
      return { ok: false, code: 'not_found' };
    }

    const provider = new UnsplashProvider();
    const candidates = await searchWithFallback(provider, parsed);
    const chosen = candidates.find((candidate) => candidate.sourceId === parsed.sourceId);

    if (!chosen) {
      return { ok: false, code: 'not_found' };
    }

    // Terms of use: the provider is told when a photo is used, and skipping it
    // is grounds for losing production access.
    await provider.reportUsage?.(chosen);

    const slot = panel.slots[parsed.slotKey];

    await updatePanelSlots(parsed.panelId, {
      ...panel.slots,
      [parsed.slotKey]: {
        type: 'image',
        value: chosen.url,
        ...(slot?.style ? { style: slot.style } : {}),
        provenance: provider.provenanceFor(chosen),
        isUserEdited: true,
      },
    });

    logger.info('Panel image replaced', { orgId: scope.orgId, panelId: parsed.panelId });

    return { ok: true };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Image choice rejected', { code });

    return { ok: false, code };
  }
}
