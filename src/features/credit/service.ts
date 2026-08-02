import { findPlanLimit } from '@/features/billing/repository';
import { conflictError, insufficientCreditsError } from '@/features/shared/errors';
import type { OrgScope } from '@/features/shared/scope';
import type { CreditEntry, CreditReason } from '@/models/Billing';
import {
  findLedgerEntry,
  getLedgerBalance,
  insertLedgerEntry,
  withOrgCreditLock,
} from './repository';

/**
 * Credit ledger operations.
 *
 * Every write is idempotent: replaying a call with the same `idempotencyKey`
 * returns the entry that was already posted and leaves the balance untouched.
 * That is what makes a retried run — or a redelivered webhook — safe to apply
 * blindly.
 */

/** Reasons that add credits. */
export type GrantReason = Extract<CreditReason, `grant.${string}`>;
/** Reasons that remove credits. */
export type SpendReason = Extract<CreditReason, `spend.${string}`>;
/** Reasons that reverse an earlier spend. */
export type RefundReason = Extract<CreditReason, `refund.${string}`>;

type LedgerRef = {
  type: string;
  id: string;
};

export type GrantInput = {
  /** Credits to add. Must be a positive integer. */
  amount: number;
  reason: GrantReason;
  idempotencyKey: string;
  /** Monthly allowances expire; purchased credits do not. */
  expiresAt?: Date;
  ref?: LedgerRef;
};

export type SpendInput = {
  /** Credits to remove. Must be a positive integer. */
  amount: number;
  reason: SpendReason;
  idempotencyKey: string;
  ref?: LedgerRef;
};

export type RefundInput = {
  /** Idempotency key of the spend being reversed. */
  spendIdempotencyKey: string;
  reason: RefundReason;
  idempotencyKey: string;
};

export type PartialRefundInput = {
  /** Credits to return. Must be a positive integer. */
  amount: number;
  reason: RefundReason;
  idempotencyKey: string;
  ref?: LedgerRef;
};

type PostInput = {
  delta: number;
  reason: CreditReason;
  idempotencyKey: string;
  expiresAt?: Date;
  ref?: LedgerRef;
};

function assertPositiveAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw conflictError(`Credit amount must be a positive integer, received ${amount}`);
  }
}

/**
 * Posts one ledger entry under the organization lock, short-circuiting replays.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The entry to post, with a signed delta.
 * @returns The posted entry, or the existing one when the key was already used.
 */
async function postEntry(scope: OrgScope, input: PostInput): Promise<CreditEntry> {
  return await withOrgCreditLock(scope, async (executor) => {
    const replay = await findLedgerEntry(scope, input.idempotencyKey, executor);

    if (replay) {
      return replay;
    }

    if (input.delta < 0) {
      const balance = await getLedgerBalance(scope, executor);

      if (balance + input.delta < 0) {
        throw insufficientCreditsError(
          `Balance ${balance} cannot cover ${Math.abs(input.delta)} credits`,
        );
      }
    }

    const posted = await insertLedgerEntry(
      scope,
      {
        delta: input.delta,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt,
        refType: input.ref?.type,
        refId: input.ref?.id,
      },
      executor,
    );

    if (!posted) {
      // The unique index is global while the lookup above is tenant-scoped, so
      // landing here means another organization holds this key.
      throw conflictError(`Idempotency key ${input.idempotencyKey} belongs to another tenant`);
    }

    return posted;
  });
}

/**
 * Reads the organization's credit balance.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @returns The balance as `SUM(delta)`.
 */
export async function getBalance(scope: OrgScope): Promise<number> {
  return await getLedgerBalance(scope);
}

/**
 * Adds credits.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - Amount, reason, and idempotency key.
 * @returns The posted entry, or the existing one on replay.
 * @throws DomainError `conflict` when the amount is not a positive integer.
 */
export async function grantCredits(scope: OrgScope, input: GrantInput): Promise<CreditEntry> {
  assertPositiveAmount(input.amount);

  return await postEntry(scope, {
    delta: input.amount,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
    ref: input.ref,
  });
}

/**
 * Removes credits, refusing to overdraw.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - Amount, reason, and idempotency key.
 * @returns The posted entry, or the existing one on replay.
 * @throws DomainError `insufficient_credits` when the balance cannot cover it.
 */
export async function spendCredits(scope: OrgScope, input: SpendInput): Promise<CreditEntry> {
  assertPositiveAmount(input.amount);

  return await postEntry(scope, {
    delta: -input.amount,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    ref: input.ref,
  });
}

/**
 * Reverses an earlier spend by posting its opposite.
 *
 * The original row stays untouched, so a failed run leaves both the charge and
 * its reversal visible rather than looking as though it never happened.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The spend to reverse plus this refund's own idempotency key.
 * @returns The refund entry, or the existing one on replay.
 * @throws DomainError `conflict` when the referenced spend does not exist or
 * was not a spend.
 */
export async function refundSpend(scope: OrgScope, input: RefundInput): Promise<CreditEntry> {
  const spend = await findLedgerEntry(scope, input.spendIdempotencyKey);

  if (!spend) {
    throw conflictError(`No spend found for key ${input.spendIdempotencyKey}`);
  }

  if (spend.delta >= 0) {
    throw conflictError(`Entry ${input.spendIdempotencyKey} is not a spend`);
  }

  return await postEntry(scope, {
    delta: -spend.delta,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    ref: spend.refType && spend.refId ? { type: spend.refType, id: spend.refId } : undefined,
  });
}

/**
 * Returns part of an earlier spend.
 *
 * A run charges up front for every cut it plans to produce, but a single failed
 * card does not invalidate the rest of the batch. This posts only the amount
 * that was not delivered, which `refundSpend` cannot express because it always
 * reverses a spend in full.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - Amount to return, reason, and idempotency key.
 * @returns The refund entry, or the existing one on replay.
 * @throws DomainError `conflict` when the amount is not a positive integer.
 */
export async function refundCredits(
  scope: OrgScope,
  input: PartialRefundInput,
): Promise<CreditEntry> {
  assertPositiveAmount(input.amount);

  return await postEntry(scope, {
    delta: input.amount,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    ref: input.ref,
  });
}

/**
 * Formats the `YYYY-MM` stamp that scopes a monthly allowance.
 *
 * @param date - Any instant inside the target month, in UTC.
 * @returns The period stamp used in the idempotency key.
 */
function monthlyPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Grants the organization's plan allowance on sign-up.
 *
 * The amount comes from `plan_limits` rather than a constant, so changing what
 * a plan includes is a data change. The idempotency key is derived from the
 * organization id alone, which makes a redelivered `organization.created`
 * webhook a no-op.
 *
 * @param scope - The organization receiving the credits.
 * @param planKey - Plan the organization is on.
 * @returns The ledger entry, or null when the plan grants no credits.
 */
export async function grantSignupCredits(
  scope: OrgScope,
  planKey: string,
): Promise<CreditEntry | null> {
  const plan = await findPlanLimit(planKey);

  if (!plan || plan.monthlyCredits <= 0) {
    return null;
  }

  return await grantCredits(scope, {
    amount: plan.monthlyCredits,
    reason: 'grant.signup',
    idempotencyKey: `signup:${scope.orgId}`,
  });
}

/**
 * Grants the organization's monthly allowance for one period.
 *
 * Keyed by period, so re-running the job for a month it already covered posts
 * nothing. The grant expires when the next period starts, which is what keeps
 * unused monthly credits from accumulating forever.
 *
 * @param scope - The organization receiving the credits.
 * @param planKey - Plan the organization is on.
 * @param periodStart - First instant of the period, in UTC.
 * @returns The ledger entry, or null when the plan grants no credits.
 */
export async function grantMonthlyCredits(
  scope: OrgScope,
  planKey: string,
  periodStart: Date,
): Promise<CreditEntry | null> {
  const plan = await findPlanLimit(planKey);

  if (!plan || plan.monthlyCredits <= 0) {
    return null;
  }

  const expiresAt = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
  );

  return await grantCredits(scope, {
    amount: plan.monthlyCredits,
    reason: 'grant.monthly',
    idempotencyKey: `monthly:${scope.orgId}:${monthlyPeriod(periodStart)}`,
    expiresAt,
  });
}
