/**
 * Turning counts into bar widths.
 *
 * Split out from the queries because it is the one part of this screen with a
 * decision in it — what a bar is measured against — and that decision is worth
 * being able to test without a database.
 */

export type ChannelShare = {
  channel: string;
  count: number;
  /** Percentage of the largest channel, so the biggest bar always fills. */
  percent: number;
};

/**
 * Scales channel counts into bar widths.
 *
 * Bars are relative to the largest channel rather than to the total. With a
 * total, a spread across five channels leaves every bar too short to compare;
 * against the leader, the shape of the mix is readable at a glance.
 *
 * @param counts - Channel counts, in any order.
 * @returns Shares sorted with the largest first.
 */
export function toChannelShares(
  counts: readonly { channel: string; count: number }[],
): ChannelShare[] {
  const sorted = [...counts].toSorted((a, b) => b.count - a.count);
  const largest = sorted[0]?.count ?? 0;

  if (largest === 0) {
    return sorted.map((entry) => ({ ...entry, percent: 0 }));
  }

  return sorted.map((entry) => ({
    ...entry,
    percent: Math.round((entry.count / largest) * 100),
  }));
}
