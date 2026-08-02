import * as z from 'zod';

/**
 * Zod schemas for editing a generated deck.
 *
 * Only text slots are editable here. Images come from generation or from an
 * upload path with its own rights confirmation, so letting an editor rewrite an
 * image slot by hand would put an unattributed picture on a card.
 */

/** Long enough for a body paragraph, short enough that a card can still hold it. */
const MAX_SLOT_LENGTH = 600;

export const updateSlotSchema = z.object({
  panelId: z.uuid(),
  slotKey: z.string().min(1).max(40),
  value: z.string().max(MAX_SLOT_LENGTH),
});

export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
