import type { OrgScope } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import { createSignedUrl, RENDER_BUCKET } from '@/libs/Storage';
import type { Panel } from '@/models/Deck';
import type { DeckDetail } from './repository';
import { findDeckDetail } from './repository';

/**
 * Deck reads for the viewer.
 *
 * Panels are stored as paths, not URLs. Signing happens here, on read, rather
 * than being persisted: a stored URL expires while the row lives on, which
 * shows the user a broken image and no way to tell why.
 */

export type PanelView = {
  id: string;
  index: number;
  role: string;
  /** Signed image URL, or null when the panel has not rendered or cannot be signed. */
  imageUrl: string | null;
  headline: string | null;
  /** Photo credit, when the provider requires attribution. */
  credit: { authorName: string | null; authorUrl: string | null; sourceUrl: string | null } | null;
};

export type DeckView = {
  deck: DeckDetail['deck'];
  panels: PanelView[];
};

/**
 * Reads the text of a slot, when it holds text.
 *
 * @param panel - The panel to read.
 * @param key - Slot name.
 * @returns The slot's text, or null.
 */
function slotText(panel: Panel, key: string): string | null {
  const slot = panel.slots[key];

  return slot?.type === 'text' ? slot.value : null;
}

/**
 * Builds the photo credit a panel has to display, if any.
 *
 * @param panel - The panel to read.
 * @returns The credit, or null when no attribution is required.
 */
function panelCredit(panel: Panel): PanelView['credit'] {
  const provenance = panel.slots.background?.provenance;

  if (!provenance?.attributionRequired) {
    return null;
  }

  return {
    authorName: provenance.authorName,
    authorUrl: provenance.authorUrl,
    sourceUrl: provenance.sourceUrl,
  };
}

/**
 * Signs one panel's image, degrading to no image rather than failing the page.
 *
 * A deck whose images cannot be signed is still worth showing: the copy is
 * there, and an error page would hide work the user paid for.
 *
 * @param panel - The panel to sign.
 * @returns The signed URL, or null.
 */
async function signPanel(panel: Panel): Promise<string | null> {
  if (!panel.renderPath) {
    return null;
  }

  try {
    return await createSignedUrl(RENDER_BUCKET, panel.renderPath);
  } catch (error) {
    logger.warn('Panel image could not be signed', {
      panelId: panel.id,
      reason: error instanceof Error ? error.message : 'unknown',
    });

    return null;
  }
}

/**
 * Reads one deck ready for display.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param deckId - Deck to read.
 * @returns The deck with signed panel images, or null when it is not the caller's.
 */
export async function getDeckView(scope: OrgScope, deckId: string): Promise<DeckView | null> {
  const detail = await findDeckDetail(scope, deckId);

  if (!detail) {
    return null;
  }

  const panels = await Promise.all(
    detail.panels.map(
      async (panel): Promise<PanelView> => ({
        id: panel.id,
        index: panel.index,
        role: panel.role,
        imageUrl: await signPanel(panel),
        headline: slotText(panel, 'headline'),
        credit: panelCredit(panel),
      }),
    ),
  );

  return { deck: detail.deck, panels };
}
