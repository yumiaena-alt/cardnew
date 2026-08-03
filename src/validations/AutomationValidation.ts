import * as z from 'zod';

/**
 * Zod schemas for DM automations.
 *
 * Keywords are normalised on the way in — lower-cased and de-duplicated —
 * because they are matched against comment text later, and matching is not the
 * place to discover that someone typed the same word twice in two cases.
 */

/** More than this and the rule is not a rule, it is a catch-all. */
const MAX_KEYWORDS = 10;

export const createAutomationSchema = z.object({
  accountId: z.uuid(),
  name: z.string().min(1).max(80),
  externalPostId: z.string().max(120).optional(),
  keywords: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(MAX_KEYWORDS)
    .transform((words) => [...new Set(words.map((word) => word.trim().toLowerCase()))]),
  message: z.string().min(1).max(900),
  linkUrl: z.url().max(500).optional(),
});

export const toggleAutomationSchema = z.object({
  automationId: z.uuid(),
  isActive: z.boolean(),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type ToggleAutomationInput = z.infer<typeof toggleAutomationSchema>;
