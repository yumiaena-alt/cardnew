import { eq, inArray } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { NewRun, NewRunItem, Run, RunItem, RunStatus } from '@/models/Run';
import { runItems, runs } from '@/models/Run';

/**
 * Run and run-item access.
 *
 * A run and its items are always written together: an item without its run
 * would be work nobody is charged for, and a run without items would be a
 * charge with nothing to show. Every read is tenant-filtered through
 * `orgScoped()` even when the caller already holds the run id.
 */

/** `db` or an open transaction. Both expose the calls used here. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Looks up a run by its idempotency key inside the caller's organization.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param idempotencyKey - Key the run was created under.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The run, or null when this organization has not created it.
 */
export async function findRunByIdempotencyKey(
  scope: OrgScope,
  idempotencyKey: string,
  executor: Executor = db,
): Promise<Run | null> {
  const [row] = await executor
    .select()
    .from(runs)
    .where(orgScoped(scope, runs, eq(runs.idempotencyKey, idempotencyKey)))
    .limit(1);

  return row ?? null;
}

/**
 * Reads a run inside the caller's organization.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param runId - Run to read.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The run, or null when it does not exist or belongs elsewhere.
 */
export async function findRun(
  scope: OrgScope,
  runId: string,
  executor: Executor = db,
): Promise<Run | null> {
  const [row] = await executor
    .select()
    .from(runs)
    .where(orgScoped(scope, runs, eq(runs.id, runId)))
    .limit(1);

  return row ?? null;
}

/**
 * Lists a run's items in insertion order.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param runId - Run whose items to list.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The items, or an empty array when the run is not the caller's.
 */
export async function listRunItems(
  scope: OrgScope,
  runId: string,
  executor: Executor = db,
): Promise<RunItem[]> {
  const run = await findRun(scope, runId, executor);

  if (!run) {
    return [];
  }

  return await executor.select().from(runItems).where(eq(runItems.runId, runId));
}

/**
 * Inserts a run and its items in one transaction.
 *
 * The unique index on `idempotency_key` is global rather than per-tenant, so a
 * conflict is reported back as null instead of being treated as this
 * organization's own replay.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param run - Run row to insert, minus `orgId`, which comes from the scope.
 * @param items - Item rows to insert, minus `runId`.
 * @returns The run with its items, or null when the key was already taken.
 */
export async function insertRunWithItems(
  scope: OrgScope,
  run: Omit<NewRun, 'orgId'>,
  items: Omit<NewRunItem, 'runId'>[],
): Promise<{ run: Run; items: RunItem[] } | null> {
  return await db.transaction(async (tx) => {
    const [insertedRun] = await tx
      .insert(runs)
      .values({ ...run, orgId: scope.orgId })
      .onConflictDoNothing({ target: runs.idempotencyKey })
      .returning();

    if (!insertedRun) {
      return null;
    }

    const insertedItems = await tx
      .insert(runItems)
      .values(items.map((item) => ({ ...item, runId: insertedRun.id })))
      .returning();

    return { run: insertedRun, items: insertedItems };
  });
}

export type RunPatch = {
  status?: RunStatus;
  chargedCredits?: number;
  refundedCredits?: number;
  startedAt?: Date;
  finishedAt?: Date;
  costSnapshot?: Run['costSnapshot'];
};

/**
 * Updates a run inside the caller's organization.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param runId - Run to update.
 * @param patch - Fields to change.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The updated run, or null when it is not the caller's.
 */
export async function updateRun(
  scope: OrgScope,
  runId: string,
  patch: RunPatch,
  executor: Executor = db,
): Promise<Run | null> {
  const [row] = await executor
    .update(runs)
    .set(patch)
    .where(orgScoped(scope, runs, eq(runs.id, runId)))
    .returning();

  return row ?? null;
}

export type RunItemPatch = {
  status?: RunStatus;
  deckId?: string;
  attempts?: number;
  errorMessage?: string | null;
};

/**
 * Updates one item of a run the caller owns.
 *
 * The ownership check runs against the parent run rather than the item, because
 * `run_items` carries no `orgId` of its own — it is reachable only through a run
 * that does.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param runId - Run the item belongs to.
 * @param itemId - Item to update.
 * @param patch - Fields to change.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The updated item, or null when the run is not the caller's.
 */
export async function updateRunItem(
  scope: OrgScope,
  runId: string,
  itemId: string,
  patch: RunItemPatch,
  executor: Executor = db,
): Promise<RunItem | null> {
  const run = await findRun(scope, runId, executor);

  if (!run) {
    return null;
  }

  const [row] = await executor
    .update(runItems)
    .set(patch)
    .where(eq(runItems.id, itemId))
    .returning();

  return row ?? null;
}

/**
 * Sets the status of several items of one run at once.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param runId - Run the items belong to.
 * @param itemIds - Items to update. An empty list is a no-op.
 * @param status - Status to apply.
 * @param executor - Open transaction, or the pool when called standalone.
 * @returns The updated items.
 */
export async function updateRunItemStatuses(
  scope: OrgScope,
  runId: string,
  itemIds: string[],
  status: RunStatus,
  executor: Executor = db,
): Promise<RunItem[]> {
  if (itemIds.length === 0) {
    return [];
  }

  const run = await findRun(scope, runId, executor);

  if (!run) {
    return [];
  }

  return await executor
    .update(runItems)
    .set({ status })
    .where(inArray(runItems.id, itemIds))
    .returning();
}
