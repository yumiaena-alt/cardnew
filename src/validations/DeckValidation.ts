import * as z from 'zod';

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
