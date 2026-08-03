import * as z from 'zod';

/**
 * Zod schemas for reference search.
 *
 * The query reaches an external API and the ledger, so it is bounded and
 * normalised here rather than downstream: the normalised form is what the
 * charge is keyed on, and two spellings of one search must not bill twice.
 */

export const referenceSearchSchema = z.object({
  query: z.string().min(2).max(120),
  kind: z.enum(['ad', 'viral']),
  windowDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});

export type ReferenceSearchInput = z.infer<typeof referenceSearchSchema>;

/**
 * Normalises a query for the charge key.
 *
 * Case and inner whitespace are collapsed so re-running the same search with a
 * stray space is recognised as the same search and not charged again.
 *
 * @param query - The raw query.
 * @returns The normalised form.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replaceAll(/\s+/gu, ' ');
}
