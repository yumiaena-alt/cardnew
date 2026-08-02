import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgScope, Scope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { CreditEntry, NewCreditEntry, PlanLimit } from '@/models/Billing';

// An in-memory stand-in for the ledger table, including the global unique index
// on `idempotency_key`. Faking the storage rather than each call lets the tests
// assert the thing that actually matters — that the balance does not move on a
// replay — instead of asserting which repository call happened.
// oxlint-disable eslint/require-await -- the repository these doubles stand in
// for is async, so they must match its signature; the in-memory store they read
// resolves synchronously and has nothing to await.
const ledger = vi.hoisted(() => ({ rows: [] as CreditEntry[] }));

vi.mock(import('./repository'), () => ({
  getLedgerBalance: async (scope: OrgScope) =>
    ledger.rows.filter((row) => row.orgId === scope.orgId).reduce((t, row) => t + row.delta, 0),

  findLedgerEntry: async (scope: OrgScope, idempotencyKey: string) =>
    ledger.rows.find((row) => row.orgId === scope.orgId && row.idempotencyKey === idempotencyKey) ??
    null,

  insertLedgerEntry: async (scope: OrgScope, entry: Omit<NewCreditEntry, 'orgId'>) => {
    const isDuplicate = ledger.rows.some((row) => row.idempotencyKey === entry.idempotencyKey);

    if (isDuplicate) {
      return null;
    }

    const row: CreditEntry = {
      id: `entry_${ledger.rows.length + 1}`,
      orgId: scope.orgId,
      delta: entry.delta,
      reason: entry.reason,
      refType: entry.refType ?? null,
      refId: entry.refId ?? null,
      idempotencyKey: entry.idempotencyKey,
      expiresAt: entry.expiresAt ?? null,
      createdAt: new Date(),
    };

    ledger.rows.push(row);

    return row;
  },

  // The real lock lives in Postgres; the fake just runs the work. `db` stands in
  // for the transaction handle, which none of the fakes above read.
  withOrgCreditLock: async <T>(_scope: OrgScope, run: (executor: typeof db) => Promise<T>) =>
    await run(db),
}));

const plans = vi.hoisted(() => ({ rows: [] as PlanLimit[] }));

vi.mock(import('@/features/billing/repository'), () => ({
  findPlanLimit: async (planKey: string) =>
    plans.rows.find((row) => row.planKey === planKey) ?? null,
}));

const {
  getBalance,
  grantCredits,
  grantMonthlyCredits,
  grantSignupCredits,
  refundSpend,
  spendCredits,
} = await import('./service');

const FREE_PLAN: PlanLimit = {
  planKey: 'free',
  monthlyCredits: 50,
  maxSocialAccounts: 1,
  maxMembers: 1,
  maxBrandAssets: 20,
  maxSavedTemplates: 5,
  hasWatermark: true,
  overageCentsPerCredit: 0,
};

const SCOPE: Scope = {
  orgId: '0f2c9c1e-6f2a-4c2f-9f2e-8d1a4b6c7e01',
  userId: '3a7b5d90-1c44-4b6e-9a02-77d5c3f1b208',
  clerkOrgId: 'org_2abc',
  clerkUserId: 'user_2xyz',
  role: 'owner',
  planKey: 'free',
};

const OTHER_SCOPE: Scope = {
  ...SCOPE,
  orgId: 'c5d4e3f2-1a09-4b8c-9d7e-6f5a4b3c2d10',
  clerkOrgId: 'org_2def',
};

const SIGNUP_GRANT = 50;

async function postSignupGrant(scope: Scope = SCOPE, key = 'grant_signup_1') {
  return await grantCredits(scope, {
    amount: SIGNUP_GRANT,
    reason: 'grant.signup',
    idempotencyKey: key,
  });
}

describe('credit ledger', () => {
  beforeEach(() => {
    ledger.rows = [];
    plans.rows = [FREE_PLAN];
  });

  describe(getBalance, () => {
    it('reports zero for an organization with no entries', async () => {
      await expect(getBalance(SCOPE)).resolves.toBe(0);
    });

    it('sums grants and spends', async () => {
      await postSignupGrant();
      await spendCredits(SCOPE, { amount: 15, reason: 'spend.run', idempotencyKey: 'run_1' });

      await expect(getBalance(SCOPE)).resolves.toBe(35);
    });

    it('ignores entries belonging to another organization', async () => {
      await postSignupGrant(OTHER_SCOPE, 'grant_signup_other');

      await expect(getBalance(SCOPE)).resolves.toBe(0);
      await expect(getBalance(OTHER_SCOPE)).resolves.toBe(SIGNUP_GRANT);
    });
  });

  describe(grantCredits, () => {
    it('leaves the balance unchanged when replayed with the same key', async () => {
      const first = await postSignupGrant();
      const replay = await postSignupGrant();

      expect(replay.id).toBe(first.id);
      await expect(getBalance(SCOPE)).resolves.toBe(SIGNUP_GRANT);
      expect(ledger.rows).toHaveLength(1);
    });

    it('rejects a non-positive amount', async () => {
      await expect(
        grantCredits(SCOPE, { amount: 0, reason: 'grant.promo', idempotencyKey: 'promo_1' }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });

    it('rejects a fractional amount', async () => {
      await expect(
        grantCredits(SCOPE, { amount: 1.5, reason: 'grant.promo', idempotencyKey: 'promo_2' }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  describe(spendCredits, () => {
    it('leaves the balance unchanged when replayed with the same key', async () => {
      await postSignupGrant();

      const first = await spendCredits(SCOPE, {
        amount: 15,
        reason: 'spend.run',
        idempotencyKey: 'run_1',
      });
      const replay = await spendCredits(SCOPE, {
        amount: 15,
        reason: 'spend.run',
        idempotencyKey: 'run_1',
      });

      expect(replay.id).toBe(first.id);
      await expect(getBalance(SCOPE)).resolves.toBe(35);
      expect(ledger.rows).toHaveLength(2);
    });

    it('refuses to overdraw and posts nothing', async () => {
      await grantCredits(SCOPE, {
        amount: 10,
        reason: 'grant.signup',
        idempotencyKey: 'grant_small',
      });

      await expect(
        spendCredits(SCOPE, { amount: 15, reason: 'spend.run', idempotencyKey: 'run_over' }),
      ).rejects.toMatchObject({ code: 'insufficient_credits' });

      await expect(getBalance(SCOPE)).resolves.toBe(10);
      expect(ledger.rows).toHaveLength(1);
    });

    it('allows a spend that lands exactly on zero', async () => {
      await postSignupGrant();

      await spendCredits(SCOPE, {
        amount: SIGNUP_GRANT,
        reason: 'spend.run',
        idempotencyKey: 'run_exact',
      });

      await expect(getBalance(SCOPE)).resolves.toBe(0);
    });

    it('cannot spend another organization credits', async () => {
      await postSignupGrant(OTHER_SCOPE, 'grant_signup_other');

      await expect(
        spendCredits(SCOPE, { amount: 15, reason: 'spend.run', idempotencyKey: 'run_cross' }),
      ).rejects.toMatchObject({ code: 'insufficient_credits' });
    });
  });

  describe(refundSpend, () => {
    it('restores the balance by posting a reversal', async () => {
      await postSignupGrant();
      await spendCredits(SCOPE, { amount: 15, reason: 'spend.run', idempotencyKey: 'run_1' });

      await refundSpend(SCOPE, {
        spendIdempotencyKey: 'run_1',
        reason: 'refund.run_failed',
        idempotencyKey: 'run_1_refund',
      });

      await expect(getBalance(SCOPE)).resolves.toBe(SIGNUP_GRANT);
      // The charge stays on the ledger next to its reversal.
      expect(ledger.rows).toHaveLength(3);
    });

    it('leaves the balance unchanged when replayed with the same key', async () => {
      await postSignupGrant();
      await spendCredits(SCOPE, { amount: 15, reason: 'spend.run', idempotencyKey: 'run_1' });
      await refundSpend(SCOPE, {
        spendIdempotencyKey: 'run_1',
        reason: 'refund.run_failed',
        idempotencyKey: 'run_1_refund',
      });
      await refundSpend(SCOPE, {
        spendIdempotencyKey: 'run_1',
        reason: 'refund.run_failed',
        idempotencyKey: 'run_1_refund',
      });

      await expect(getBalance(SCOPE)).resolves.toBe(SIGNUP_GRANT);
      expect(ledger.rows).toHaveLength(3);
    });

    it('carries the reference of the spend it reverses', async () => {
      await postSignupGrant();
      await spendCredits(SCOPE, {
        amount: 15,
        reason: 'spend.run',
        idempotencyKey: 'run_1',
        ref: { type: 'run', id: 'run-uuid' },
      });

      const refund = await refundSpend(SCOPE, {
        spendIdempotencyKey: 'run_1',
        reason: 'refund.run_failed',
        idempotencyKey: 'run_1_refund',
      });

      expect(refund.refType).toBe('run');
      expect(refund.refId).toBe('run-uuid');
    });

    it('rejects a refund for an unknown spend', async () => {
      await expect(
        refundSpend(SCOPE, {
          spendIdempotencyKey: 'never_posted',
          reason: 'refund.manual',
          idempotencyKey: 'refund_1',
        }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });

    it('rejects a refund that points at a grant', async () => {
      await postSignupGrant();

      await expect(
        refundSpend(SCOPE, {
          spendIdempotencyKey: 'grant_signup_1',
          reason: 'refund.manual',
          idempotencyKey: 'refund_2',
        }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  describe(grantSignupCredits, () => {
    it('grants the allowance configured on the plan', async () => {
      await grantSignupCredits(SCOPE, 'free');

      await expect(getBalance(SCOPE)).resolves.toBe(FREE_PLAN.monthlyCredits);
    });

    it('grants nothing twice for the same organization', async () => {
      await grantSignupCredits(SCOPE, 'free');
      await grantSignupCredits(SCOPE, 'free');

      await expect(getBalance(SCOPE)).resolves.toBe(FREE_PLAN.monthlyCredits);
      expect(ledger.rows).toHaveLength(1);
    });

    it('skips an unconfigured plan', async () => {
      await expect(grantSignupCredits(SCOPE, 'enterprise')).resolves.toBeNull();
      await expect(getBalance(SCOPE)).resolves.toBe(0);
    });
  });

  describe(grantMonthlyCredits, () => {
    it('grants once per period and expires at the next one', async () => {
      const entry = await grantMonthlyCredits(SCOPE, 'free', new Date('2026-08-01T00:00:00Z'));

      expect(entry?.expiresAt).toStrictEqual(new Date('2026-09-01T00:00:00Z'));
      await expect(getBalance(SCOPE)).resolves.toBe(FREE_PLAN.monthlyCredits);
    });

    it('posts nothing when the job re-runs for a period it already covered', async () => {
      await grantMonthlyCredits(SCOPE, 'free', new Date('2026-08-01T00:00:00Z'));
      await grantMonthlyCredits(SCOPE, 'free', new Date('2026-08-17T09:30:00Z'));

      await expect(getBalance(SCOPE)).resolves.toBe(FREE_PLAN.monthlyCredits);
      expect(ledger.rows).toHaveLength(1);
    });

    it('grants again in the following period', async () => {
      await grantMonthlyCredits(SCOPE, 'free', new Date('2026-08-01T00:00:00Z'));
      await grantMonthlyCredits(SCOPE, 'free', new Date('2026-09-01T00:00:00Z'));

      await expect(getBalance(SCOPE)).resolves.toBe(FREE_PLAN.monthlyCredits * 2);
    });

    it('rolls the period over at the year boundary', async () => {
      const entry = await grantMonthlyCredits(SCOPE, 'free', new Date('2026-12-05T00:00:00Z'));

      expect(entry?.expiresAt).toStrictEqual(new Date('2027-01-01T00:00:00Z'));
    });
  });
});
