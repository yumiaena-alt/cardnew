import { eq, sql } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { CreditEntry, NewCreditEntry } from '@/models/Billing';
import { creditLedger } from '@/models/Billing';

/**
 * Credit ledger access.
 *
 * There is no balance column anywhere: the balance is `SUM(delta)` over the
 * organization's rows, every time. That makes a charge and its refund two
 * durable facts rather than an in-place edit, so an incorrect balance is always
 * traceable to the entries that produced it.
 */

/** `db` or an open transaction. Both expose the calls used here. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Sums the organization's ledger.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The current balance. Zero for an organization with no entries.
 */
export async function getLedgerBalance(scope: OrgScope, executor: Executor = db): Promise<number> {
  const [row] = await executor
    .select({ balance: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(orgScoped(scope, creditLedger));

  return row?.balance ?? 0;
}

/**
 * Looks up an entry by its idempotency key inside the caller's organization.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param idempotencyKey - Key the caller posted the entry under.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The entry, or null when this organization has not posted it.
 */
export async function findLedgerEntry(
  scope: OrgScope,
  idempotencyKey: string,
  executor: Executor = db,
): Promise<CreditEntry | null> {
  const [row] = await executor
    .select()
    .from(creditLedger)
    .where(orgScoped(scope, creditLedger, eq(creditLedger.idempotencyKey, idempotencyKey)))
    .limit(1);

  return row ?? null;
}

/**
 * Posts a ledger entry, letting the unique index reject a replay.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param entry - Row to insert, minus `orgId`, which comes from the scope.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The inserted entry, or null when the key was already used.
 */
export async function insertLedgerEntry(
  scope: OrgScope,
  entry: Omit<NewCreditEntry, 'orgId'>,
  executor: Executor = db,
): Promise<CreditEntry | null> {
  const [row] = await executor
    .insert(creditLedger)
    .values({ ...entry, orgId: scope.orgId })
    .onConflictDoNothing({ target: creditLedger.idempotencyKey })
    .returning();

  return row ?? null;
}

/**
 * Runs a ledger write under a per-organization lock.
 *
 * A spend reads the balance and then writes against it, so without a lock two
 * concurrent runs can both observe enough credits and overdraw. The advisory
 * lock is held by Postgres for the life of the transaction, so it serialises
 * across processes — which matters once generation moves onto a job queue.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param run - Work to perform while holding the lock.
 * @returns Whatever `run` returns.
 */
export async function withOrgCreditLock<T>(
  scope: OrgScope,
  run: (executor: Executor) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope.orgId}))`);

    return await run(tx);
  });
}
