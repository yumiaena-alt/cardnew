import { refundCredits, spendCredits } from '@/features/credit/service';
import { conflictError, isDomainError, notFoundError } from '@/features/shared/errors';
import type { Scope } from '@/features/shared/scope';
import { requirePermission } from '@/features/shared/scope';
import type { Run, RunItem } from '@/models/Run';
import type { CreateRunInput } from '@/validations/RunValidation';
import { createRunSchema } from '@/validations/RunValidation';
import type { RunEstimate } from './estimate';
import { estimateRun } from './estimate';
import { enqueueRun } from './queue';
import {
  findRunByIdempotencyKey,
  insertRunWithItems,
  listRunItems,
  updateRun,
  updateRunItem,
} from './repository';

/**
 * The generation run entry point.
 *
 * Follows the pipeline order in docs/02-ARCHITECTURE.md §5-2. Batch is the base
 * case and a single deck is simply a run of one, so adding batch later cannot
 * force a rewrite of the single-item path.
 *
 * Credits are charged before the work is queued, never after. Charging on
 * completion would let a user start more runs than they can pay for, and every
 * one of them would already have cost us provider spend by the time the balance
 * was checked.
 */

/** A dry run. Nothing was written and no credits moved. */
type RunQuote = {
  dryRun: true;
  estimate: RunEstimate;
};

/** A real run: charged, persisted, and waiting to be picked up. */
type RunReceipt = {
  dryRun: false;
  estimate: RunEstimate;
  run: Run;
  items: RunItem[];
};

export type CreateRunResult = RunQuote | RunReceipt;

/**
 * Charges a run and moves it to `queued`.
 *
 * Split out because it runs both for a fresh run and when an earlier attempt
 * died between inserting the run and charging it: the spend key is derived from
 * the run id, so resuming re-posts nothing and simply finishes the transition.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param run - The run to charge, carrying the estimate it was created with.
 * @returns The run in `queued`.
 * @throws DomainError `insufficient_credits` when the balance cannot cover it.
 */
async function chargeAndQueue(scope: Scope, run: Run): Promise<Run> {
  const spendKey = `run:${run.id}`;

  try {
    await spendCredits(scope, {
      amount: run.estimatedCredits,
      reason: 'spend.run',
      idempotencyKey: spendKey,
      ref: { type: 'run', id: run.id },
    });
  } catch (error) {
    if (isDomainError(error, 'insufficient_credits')) {
      await updateRun(scope, run.id, { status: 'canceled', finishedAt: new Date() });
    }

    throw error;
  }

  const queued = await updateRun(scope, run.id, {
    status: 'queued',
    chargedCredits: run.estimatedCredits,
  });

  try {
    await enqueueRun({ runId: run.id, orgId: scope.orgId, userId: scope.userId });
  } catch (error) {
    // The charge landed but nothing will ever pick the run up. Returning the
    // credits here is what keeps the invariant that a charge always buys either
    // the cards or a refund — without it the user pays for silence.
    await refundCredits(scope, {
      amount: run.estimatedCredits,
      reason: 'refund.run_failed',
      idempotencyKey: `${spendKey}:refund`,
      ref: { type: 'run', id: run.id },
    });

    await updateRun(scope, run.id, {
      status: 'failed',
      refundedCredits: run.estimatedCredits,
      finishedAt: new Date(),
    });

    throw error;
  }

  return queued ?? run;
}

/**
 * Creates a generation run, or quotes one.
 *
 * With `dryRun` the estimate is returned and nothing is written — this is the
 * quote the user sees before any credit moves. Otherwise the run and its items
 * are persisted, the credits are charged, and the run is left in `queued` for
 * the worker to pick up.
 *
 * Replaying the same `idempotencyKey` returns the run that already exists
 * instead of charging twice.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param input - Items, regeneration scope, idempotency key, and dry-run flag.
 * @returns The quote, or the charged run with its items.
 * @throws DomainError `forbidden` when the role cannot execute runs.
 * @throws DomainError `conflict` when the idempotency key belongs to another tenant.
 * @throws DomainError `insufficient_credits` when the balance cannot cover the estimate.
 */
export async function createRun(scope: Scope, input: CreateRunInput): Promise<CreateRunResult> {
  requirePermission(scope, 'run:execute');

  const parsed = createRunSchema.parse(input);
  const estimate = estimateRun(parsed);

  if (parsed.dryRun) {
    return { dryRun: true, estimate };
  }

  const existing = await findRunByIdempotencyKey(scope, parsed.idempotencyKey);

  if (existing) {
    const run = existing.status === 'estimated' ? await chargeAndQueue(scope, existing) : existing;

    return { dryRun: false, estimate, run, items: await listRunItems(scope, run.id) };
  }

  const inserted = await insertRunWithItems(
    scope,
    {
      boardId: parsed.boardId,
      status: 'estimated',
      scopeKind: parsed.scope.kind,
      itemCount: estimate.cuts.length,
      estimatedCredits: estimate.total,
      idempotencyKey: parsed.idempotencyKey,
      createdBy: scope.userId,
    },
    estimate.cuts.map((cut) => ({
      rowId: cut.sourceRowId,
      topic: cut.topic,
      channel: cut.channel,
      ratio: cut.ratio,
      templateVersionId: cut.templateVersionId,
      isOrigin: cut.isOrigin,
      estimatedCredits: cut.credits,
    })),
  );

  if (!inserted) {
    throw conflictError(`Idempotency key ${parsed.idempotencyKey} belongs to another tenant`);
  }

  return {
    dryRun: false,
    estimate,
    run: await chargeAndQueue(scope, inserted.run),
    items: inserted.items,
  };
}

/**
 * What became of one cut.
 *
 * `canceled` is distinct from `failed` on purpose: it marks a cut that was never
 * attempted because the run aborted before reaching it, which is what happens
 * when the very first cut fails.
 */
export type RunItemOutcome = {
  itemId: string;
  status: 'done' | 'failed' | 'canceled';
  deckId?: string;
  errorMessage?: string;
};

export type FinalizeRunInput = {
  outcomes: RunItemOutcome[];
  costSnapshot?: Run['costSnapshot'];
};

/**
 * Closes a run and returns the credits for whatever it did not deliver.
 *
 * Partial failure is the normal case, not an edge case: one card that fails to
 * render leaves the rest of the batch standing, and only the cuts that were not
 * produced are refunded. A run counts as `failed` only when nothing at all came
 * out of it — which is what a failure on the very first cut produces, since the
 * worker stops there rather than burning credits on cuts that will fail the same
 * way.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param runId - Run to close.
 * @param input - Per-item outcomes and the measured provider cost.
 * @returns The closed run.
 * @throws DomainError `not_found` when the run is not the caller's.
 */
export async function finalizeRun(
  scope: Scope,
  runId: string,
  input: FinalizeRunInput,
): Promise<Run> {
  const items = await listRunItems(scope, runId);

  if (items.length === 0) {
    throw notFoundError(`Run ${runId} not found`);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  let undelivered = 0;

  for (const outcome of input.outcomes) {
    const item = byId.get(outcome.itemId);

    if (!item) {
      continue;
    }

    if (outcome.status !== 'done') {
      undelivered += item.estimatedCredits;
    }

    await updateRunItem(scope, runId, outcome.itemId, {
      status: outcome.status,
      deckId: outcome.deckId,
      errorMessage: outcome.errorMessage ?? null,
    });
  }

  if (undelivered > 0) {
    await refundCredits(scope, {
      amount: undelivered,
      reason: 'refund.run_failed',
      idempotencyKey: `run:${runId}:refund`,
      ref: { type: 'run', id: runId },
    });
  }

  const delivered = input.outcomes.some((outcome) => outcome.status === 'done');

  const closed = await updateRun(scope, runId, {
    status: delivered ? 'done' : 'failed',
    refundedCredits: undelivered,
    finishedAt: new Date(),
    costSnapshot: input.costSnapshot,
  });

  if (!closed) {
    throw notFoundError(`Run ${runId} not found`);
  }

  return closed;
}
