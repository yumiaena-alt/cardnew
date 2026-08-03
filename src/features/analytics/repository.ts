import { count, gte, isNull, sql } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import { creditLedger } from '@/models/Billing';
import { blogPosts } from '@/models/Blog';
import { decks } from '@/models/Deck';
import { runs } from '@/models/Run';

/**
 * Production figures.
 *
 * Everything here is what this product itself did — decks made, credits spent,
 * runs that finished. Reach and engagement live on the networks and need an
 * account connection, so they are absent rather than estimated: a made-up
 * impression count is worse than an empty panel, because someone will plan
 * around it.
 */

type ChannelCount = {
  channel: string;
  count: number;
};

export type ProductionStats = {
  deckTotal: number;
  deckThisMonth: number;
  blogTotal: number;
  creditsSpentThisMonth: number;
  runsDone: number;
  runsFailed: number;
  byChannel: ChannelCount[];
};

/**
 * Returns the first instant of the month containing a date.
 *
 * @param now - Any instant inside the target month.
 * @returns The month start, in UTC.
 */
function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Reads the organization's production figures.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param now - The instant deciding which month "this month" means.
 * @returns The figures the analytics screen renders.
 */
export async function loadProductionStats(
  scope: OrgScope,
  now: Date = new Date(),
): Promise<ProductionStats> {
  const since = monthStart(now);

  const [deckTotalRows, deckMonthRows, blogRows, spendRows, runRows, channelRows] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(decks)
        .where(orgScoped(scope, decks, isNull(decks.deletedAt))),

      db
        .select({ value: count() })
        .from(decks)
        .where(orgScoped(scope, decks, isNull(decks.deletedAt), gte(decks.createdAt, since))),

      db
        .select({ value: count() })
        .from(blogPosts)
        .where(orgScoped(scope, blogPosts, isNull(blogPosts.deletedAt))),

      // Spend only. Grants are positive and would cancel out the number this
      // panel exists to show.
      db
        .select({ value: sql<number>`coalesce(-sum(${creditLedger.delta}), 0)::int` })
        .from(creditLedger)
        .where(
          orgScoped(
            scope,
            creditLedger,
            sql`${creditLedger.delta} < 0`,
            gte(creditLedger.createdAt, since),
          ),
        ),

      db
        .select({ status: runs.status, value: count() })
        .from(runs)
        .where(orgScoped(scope, runs))
        .groupBy(runs.status),

      db
        .select({ channel: decks.channel, value: count() })
        .from(decks)
        .where(orgScoped(scope, decks, isNull(decks.deletedAt)))
        .groupBy(decks.channel),
    ]);

  const runsByStatus = new Map(runRows.map((row) => [row.status, row.value]));

  return {
    deckTotal: deckTotalRows[0]?.value ?? 0,
    deckThisMonth: deckMonthRows[0]?.value ?? 0,
    blogTotal: blogRows[0]?.value ?? 0,
    creditsSpentThisMonth: spendRows[0]?.value ?? 0,
    runsDone: runsByStatus.get('done') ?? 0,
    runsFailed: runsByStatus.get('failed') ?? 0,
    byChannel: channelRows
      .map((row) => ({ channel: row.channel, count: row.value }))
      .toSorted((a, b) => b.count - a.count),
  };
}
