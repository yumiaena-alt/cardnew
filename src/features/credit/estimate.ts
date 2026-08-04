/**
 * Credit pricing for generation runs.
 *
 * Rates live here rather than in components so the Board estimate, the
 * DryRunPanel, and the server-side charge all read the same numbers. See
 * docs/01-PRD.md §4.
 */

export const CREDIT_RATES = {
  /** Full deck: planning, layout, and imagery. */
  originDeck: 15,
  /** Channel cut: reuses the origin copy, only re-lays out. */
  derivedCut: 5,
  /** Single panel regenerated in place. */
  panel: 3,
  /** Single slot regenerated in place. */
  slot: 1,
  /**
   * Reference images turned into a reusable template.
   *
   * Ten images cost about 10 cents of model time — the images alone are 5.8 of
   * that — against 5 cents a credit. Five credits cleared cost by 2.5x, which
   * is under the floor once the render host, storage and refunds are counted.
   * See `run/providerCost.ts`.
   */
  designLearning: 10,
  /** One ad-library search. Charged once per query per day, not per attempt. */
  referenceSearch: 1,
  /**
   * One long-form draft. Priced at the derived-cut rate because that is what it
   * is: the same thinking as a deck, written out long instead of laid out.
   */
  blogPost: 5,
} as const;

export type BoardRowEstimateInput = {
  hasTopic: boolean;
  channelCount: number;
};

export type BoardEstimate = {
  /** Rows that will actually run — a row without a topic is skipped. */
  rowCount: number;
  originCount: number;
  cutCount: number;
  total: number;
};

/**
 * Estimates the credits a Board run would cost.
 *
 * The first selected channel is the origin deck; the rest are derived cuts, so
 * adding channels is deliberately cheap. Rows without a topic are skipped
 * rather than charged, which lets users leave blank rows in the sheet.
 *
 * @param rows - Per-row topic presence and selected channel count.
 * @returns Row, origin, and cut counts with the credit total.
 */
export function estimateBoardCredits(rows: readonly BoardRowEstimateInput[]): BoardEstimate {
  let rowCount = 0;
  let originCount = 0;
  let cutCount = 0;

  for (const row of rows) {
    if (!row.hasTopic || row.channelCount === 0) {
      continue;
    }

    rowCount += 1;
    originCount += 1;
    cutCount += row.channelCount - 1;
  }

  return {
    rowCount,
    originCount,
    cutCount,
    total: originCount * CREDIT_RATES.originDeck + cutCount * CREDIT_RATES.derivedCut,
  };
}
