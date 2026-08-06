import * as z from 'zod';
import { slideDocSchema } from '@/lib/slidedoc/doc';

/**
 * Zod schemas for editing a generated deck.
 *
 * Only text slots are editable here. Images come from generation or from an
 * upload path with its own rights confirmation, so letting an editor rewrite an
 * image slot by hand would put an unattributed picture on a card.
 */

/**
 * Copy limits, matching `slidePlanSchema` exactly.
 *
 * These are measured, not stylistic: at 4:5 an 864px text column fits about 14
 * Korean characters per line, so a 28-character headline is two lines. Letting
 * an edit exceed what generation is allowed to produce would store copy the
 * layout cannot render, and the mismatch would only surface as an overflow
 * warning after the next regeneration.
 */
export const SLOT_LIMITS: Record<string, number> = {
  headline: 28,
  body: 90,
  eyebrow: 20,
};

/** Fallback for a slot the plan schema does not name. */
const DEFAULT_SLOT_LIMIT = 90;

export const updateSlotSchema = z
  .object({
    panelId: z.uuid(),
    slotKey: z.string().min(1).max(40),
    value: z.string().max(200),
  })
  .refine((input) => input.value.length <= (SLOT_LIMITS[input.slotKey] ?? DEFAULT_SLOT_LIMIT), {
    message: 'Slot copy is longer than the layout can hold',
  });

export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;

/**
 * A layout edit saved from the canvas.
 *
 * The whole document is sent rather than a patch: the editor holds it as one
 * value, and a partial update would need the server to reconstruct what the
 * user is looking at in order to apply it.
 */
export const savePanelDocSchema = z.object({
  panelId: z.uuid(),
  doc: slideDocSchema,
});

export type SavePanelDocInput = z.infer<typeof savePanelDocSchema>;

const orientationSchema = z.enum(['landscape', 'portrait', 'squarish']);

export const searchImagesSchema = z.object({
  query: z.string().min(1).max(200),
  orientation: orientationSchema,
});

export type SearchImagesInput = z.infer<typeof searchImagesSchema>;

/**
 * Picking a photo names the search it came from.
 *
 * The candidate itself is not sent back. A client that could hand over an
 * arbitrary URL and have it recorded as sourced photography would be a way to
 * put anything into a card with a provenance record vouching for it.
 */
export const chooseImageSchema = z.object({
  panelId: z.uuid(),
  slotKey: z.string().min(1).max(50),
  sourceId: z.string().min(1).max(200),
  query: z.string().min(1).max(200),
  orientation: orientationSchema,
});

export type ChooseImageInput = z.infer<typeof chooseImageSchema>;
