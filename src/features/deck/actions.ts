'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import { PANEL_CONTENT_TYPE, renderPanel } from '@/libs/RenderService';
import { RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import type { SavePanelDocInput, UpdateSlotInput } from '@/validations/DeckValidation';
import { savePanelDocSchema, updateSlotSchema } from '@/validations/DeckValidation';
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
