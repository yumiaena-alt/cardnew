import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/features/shared/errors';
import type { OrgScope, Scope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { CreditEntry, NewCreditEntry } from '@/models/Billing';
import type { NewRun, NewRunItem, Run, RunItem } from '@/models/Run';
import type { CreateRunInput } from '@/validations/RunValidation';

// In-memory stand-ins for the two tables this service spans. Faking storage
// rather than individual calls keeps the assertions on what the user would
// notice — how much was charged, how much came back — instead of on which
// repository function ran.
// oxlint-disable eslint/require-await -- the repositories these doubles stand in
// for are async, so the signatures must match; the stores resolve synchronously.
const store = vi.hoisted(() => ({
  runs: [] as Run[],
  items: [] as RunItem[],
  ledger: [] as CreditEntry[],
}));

vi.mock(import('./repository'), () => ({
  findRunByIdempotencyKey: async (scope: OrgScope, key: string) =>
    store.runs.find((row) => row.orgId === scope.orgId && row.idempotencyKey === key) ?? null,

  findRun: async (scope: OrgScope, runId: string) =>
    store.runs.find((row) => row.orgId === scope.orgId && row.id === runId) ?? null,

  listRunItems: async (scope: OrgScope, runId: string) => {
    const owned = store.runs.some((row) => row.orgId === scope.orgId && row.id === runId);

    return owned ? store.items.filter((item) => item.runId === runId) : [];
  },

  insertRunWithItems: async (
    scope: OrgScope,
    run: Omit<NewRun, 'orgId'>,
    items: Omit<NewRunItem, 'runId'>[],
  ) => {
    if (store.runs.some((row) => row.idempotencyKey === run.idempotencyKey)) {
      return null;
    }

    const inserted = {
      ...run,
      id: `run_${store.runs.length + 1}`,
      orgId: scope.orgId,
      status: run.status ?? 'estimated',
      scopeKind: run.scopeKind ?? 'full',
      chargedCredits: 0,
      refundedCredits: 0,
      costSnapshot: null,
      boardId: run.boardId ?? null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
    } as Run;

    store.runs.push(inserted);

    const insertedItems = items.map(
      (item, index) =>
        ({
          ...item,
          id: `item_${store.items.length + index + 1}`,
          runId: inserted.id,
          rowId: item.rowId ?? null,
          deckId: null,
          status: 'queued',
          attempts: 0,
          errorMessage: null,
        }) as RunItem,
    );

    store.items.push(...insertedItems);

    return { run: inserted, items: insertedItems };
  },

  updateRun: async (scope: OrgScope, runId: string, patch: Partial<Run>) => {
    const run = store.runs.find((row) => row.orgId === scope.orgId && row.id === runId);

    if (!run) {
      return null;
    }

    Object.assign(run, patch);

    return run;
  },

  updateRunItem: async (
    scope: OrgScope,
    runId: string,
    itemId: string,
    patch: Partial<RunItem>,
  ) => {
    const owned = store.runs.some((row) => row.orgId === scope.orgId && row.id === runId);
    const item = store.items.find((row) => row.id === itemId);

    if (!(owned && item)) {
      return null;
    }

    Object.assign(item, patch);

    return item;
  },

  updateRunItemStatuses: async () => [],
}));

vi.mock(import('@/features/credit/repository'), () => ({
  getLedgerBalance: async (scope: OrgScope) =>
    store.ledger.filter((row) => row.orgId === scope.orgId).reduce((t, row) => t + row.delta, 0),

  findLedgerEntry: async (scope: OrgScope, key: string) =>
    store.ledger.find((row) => row.orgId === scope.orgId && row.idempotencyKey === key) ?? null,

  insertLedgerEntry: async (scope: OrgScope, entry: Omit<NewCreditEntry, 'orgId'>) => {
    if (store.ledger.some((row) => row.idempotencyKey === entry.idempotencyKey)) {
      return null;
    }

    const row = {
      ...entry,
      id: `entry_${store.ledger.length + 1}`,
      orgId: scope.orgId,
      refType: entry.refType ?? null,
      refId: entry.refId ?? null,
      expiresAt: entry.expiresAt ?? null,
      createdAt: new Date(),
    } as CreditEntry;

    store.ledger.push(row);

    return row;
  },

  withOrgCreditLock: async <T>(_scope: OrgScope, run: (executor: typeof db) => Promise<T>) =>
    await run(db),
}));

const { createRun, finalizeRun } = await import('./service');
const { getBalance } = await import('@/features/credit/service');

type CreateRunResult = Awaited<ReturnType<typeof createRun>>;
type RunReceipt = Extract<CreateRunResult, { dryRun: false }>;

const ORG_ID = 'org_1';
const TEMPLATE_VERSION_ID = '3f6d1e4a-0d2e-4f8a-9c7b-2a1d5e8c4b90';

const ownerScope: Scope = {
  orgId: ORG_ID,
  userId: 'user_1',
  clerkOrgId: 'org_clerk',
  clerkUserId: 'user_clerk',
  role: 'owner',
  planKey: 'standard',
};

const origin = { channel: 'instagram', ratio: '4:5', isOrigin: true } as const;
const reelsCut = { channel: 'tiktok', ratio: '9:16', isOrigin: false } as const;

function runInput(overrides: Partial<CreateRunInput> = {}): CreateRunInput {
  return {
    items: [
      { topic: '여름 신메뉴 소개', templateVersionId: TEMPLATE_VERSION_ID, targets: [origin] },
    ],
    scope: { kind: 'full' },
    idempotencyKey: 'board:2026-08:row-1',
    dryRun: false,
    ...overrides,
  };
}

// Narrows a result to a charged run, failing the test when it is only a quote.
function receipt(result: CreateRunResult): RunReceipt {
  if (result.dryRun) {
    throw new Error('Expected a charged run, received a quote');
  }

  return result;
}

// Builds a complete run row, so a test can seed state without a partial cast.
function makeRun(overrides: Partial<Run>): Run {
  return {
    id: 'run_seed',
    orgId: ORG_ID,
    boardId: null,
    status: 'estimated',
    scopeKind: 'full',
    itemCount: 1,
    estimatedCredits: 15,
    chargedCredits: 0,
    refundedCredits: 0,
    idempotencyKey: 'seed',
    costSnapshot: null,
    startedAt: null,
    finishedAt: null,
    createdBy: 'user_1',
    createdAt: new Date(),
    ...overrides,
  };
}

function fund(amount: number) {
  store.ledger.push({
    id: `grant_${store.ledger.length + 1}`,
    orgId: ORG_ID,
    delta: amount,
    reason: 'grant.signup',
    refType: null,
    refId: null,
    idempotencyKey: `grant_${store.ledger.length + 1}`,
    expiresAt: null,
    createdAt: new Date(),
  } as CreditEntry);
}

function resetStore() {
  store.runs = [];
  store.items = [];
  store.ledger = [];
}

describe(createRun, () => {
  beforeEach(resetStore);

  describe('dry run', () => {
    it('returns a quote without writing a run', async () => {
      fund(100);

      const result = await createRun(ownerScope, runInput({ dryRun: true }));

      expect(result).toMatchObject({ dryRun: true, estimate: { total: 15 } });
      expect(store.runs).toHaveLength(0);
    });

    it('leaves the balance untouched', async () => {
      fund(100);

      await createRun(ownerScope, runInput({ dryRun: true }));

      await expect(getBalance(ownerScope)).resolves.toBe(100);
    });

    it('quotes a run the balance cannot cover instead of refusing it', async () => {
      const result = await createRun(ownerScope, runInput({ dryRun: true }));

      expect(result).toMatchObject({ dryRun: true, estimate: { total: 15 } });
      await expect(getBalance(ownerScope)).resolves.toBe(0);
    });
  });

  describe('charging', () => {
    it('charges the quoted amount and queues the run', async () => {
      fund(100);

      const result = await createRun(ownerScope, runInput());

      expect(result).toMatchObject({
        dryRun: false,
        run: { status: 'queued', chargedCredits: 15, estimatedCredits: 15 },
      });
      await expect(getBalance(ownerScope)).resolves.toBe(85);
    });

    it('writes one item per cut', async () => {
      fund(100);

      const result = await createRun(
        ownerScope,
        runInput({
          items: [
            {
              topic: '여름 신메뉴 소개',
              templateVersionId: TEMPLATE_VERSION_ID,
              targets: [origin, reelsCut],
            },
          ],
        }),
      );

      expect(receipt(result).items).toHaveLength(2);
      expect(store.items.map((item) => item.estimatedCredits)).toStrictEqual([15, 5]);
    });

    it('refuses a run the balance cannot cover', async () => {
      fund(10);

      await expect(createRun(ownerScope, runInput())).rejects.toMatchObject({
        code: 'insufficient_credits',
      });
    });

    it('cancels the run it could not charge', async () => {
      fund(10);

      await createRun(ownerScope, runInput()).catch(() => null);

      expect(store.runs[0]).toMatchObject({ status: 'canceled', chargedCredits: 0 });
    });
  });

  describe('idempotency', () => {
    it('returns the existing run rather than charging again', async () => {
      fund(100);

      const first = receipt(await createRun(ownerScope, runInput()));
      const second = await createRun(ownerScope, runInput());

      expect(second).toMatchObject({ dryRun: false, run: { id: first.run.id } });
      expect(store.runs).toHaveLength(1);
      await expect(getBalance(ownerScope)).resolves.toBe(85);
    });

    it('resumes a run that was written but never charged', async () => {
      fund(100);
      store.runs.push(
        makeRun({ id: 'run_stuck', status: 'estimated', idempotencyKey: 'board:2026-08:row-1' }),
      );

      const result = await createRun(ownerScope, runInput());

      expect(result).toMatchObject({ run: { id: 'run_stuck', status: 'queued' } });
      await expect(getBalance(ownerScope)).resolves.toBe(85);
    });

    it('rejects a key another tenant already holds', async () => {
      fund(100);
      store.runs.push(
        makeRun({
          id: 'run_other',
          orgId: 'org_2',
          status: 'queued',
          idempotencyKey: 'board:2026-08:row-1',
        }),
      );

      await expect(createRun(ownerScope, runInput())).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  describe('authorization', () => {
    it('rejects a role that cannot execute runs', async () => {
      fund(100);

      await expect(createRun({ ...ownerScope, role: 'viewer' }, runInput())).rejects.toMatchObject({
        code: 'forbidden',
      });
    });

    it('rejects an item with no origin target', async () => {
      fund(100);

      await expect(
        createRun(
          ownerScope,
          runInput({
            items: [
              {
                topic: '여름 신메뉴 소개',
                templateVersionId: TEMPLATE_VERSION_ID,
                targets: [reelsCut],
              },
            ],
          }),
        ),
      ).rejects.toThrow('Exactly one target must be the origin');
    });
  });
});

describe(finalizeRun, () => {
  beforeEach(resetStore);

  async function queueThreeCuts() {
    fund(100);

    await createRun(
      ownerScope,
      runInput({
        items: [
          {
            topic: '여름 신메뉴 소개',
            templateVersionId: TEMPLATE_VERSION_ID,
            targets: [origin, reelsCut, { channel: 'threads', ratio: '1:1', isOrigin: false }],
          },
        ],
      }),
    );

    return { runId: store.runs[0]?.id ?? '', itemIds: store.items.map((item) => item.id) };
  }

  it('returns credits only for the cuts that failed', async () => {
    const { runId, itemIds } = await queueThreeCuts();

    const closed = await finalizeRun(ownerScope, runId, {
      outcomes: [
        { itemId: itemIds[0] ?? '', status: 'done', deckId: 'deck_1' },
        { itemId: itemIds[1] ?? '', status: 'failed', errorMessage: 'render timeout' },
        { itemId: itemIds[2] ?? '', status: 'done', deckId: 'deck_2' },
      ],
    });

    expect(closed).toMatchObject({ status: 'done', refundedCredits: 5 });
    await expect(getBalance(ownerScope)).resolves.toBe(80);
  });

  it('keeps the delivered cuts marked done', async () => {
    const { runId, itemIds } = await queueThreeCuts();

    await finalizeRun(ownerScope, runId, {
      outcomes: [
        { itemId: itemIds[0] ?? '', status: 'done', deckId: 'deck_1' },
        { itemId: itemIds[1] ?? '', status: 'failed', errorMessage: 'render timeout' },
        { itemId: itemIds[2] ?? '', status: 'done', deckId: 'deck_2' },
      ],
    });

    expect(store.items.map((item) => item.status)).toStrictEqual(['done', 'failed', 'done']);
  });

  it('returns the whole charge when the first cut fails and the rest never run', async () => {
    const { runId, itemIds } = await queueThreeCuts();

    const closed = await finalizeRun(ownerScope, runId, {
      outcomes: [
        { itemId: itemIds[0] ?? '', status: 'failed', errorMessage: 'planner unreachable' },
        { itemId: itemIds[1] ?? '', status: 'canceled' },
        { itemId: itemIds[2] ?? '', status: 'canceled' },
      ],
    });

    expect(closed).toMatchObject({ status: 'failed', refundedCredits: 25 });
    await expect(getBalance(ownerScope)).resolves.toBe(100);
  });

  it('records the measured provider cost', async () => {
    const { runId, itemIds } = await queueThreeCuts();
    const costSnapshot = {
      llmInputTokens: 1200,
      llmOutputTokens: 3400,
      imageCount: 8,
      providerCostUsd: 0.14,
    };

    const closed = await finalizeRun(ownerScope, runId, {
      outcomes: itemIds.map((itemId) => ({ itemId, status: 'done' as const })),
      costSnapshot,
    });

    expect(closed.costSnapshot).toStrictEqual(costSnapshot);
  });

  it('refunds once when the same close is replayed', async () => {
    const { runId, itemIds } = await queueThreeCuts();
    const outcomes = [
      { itemId: itemIds[0] ?? '', status: 'done' as const },
      { itemId: itemIds[1] ?? '', status: 'failed' as const },
      { itemId: itemIds[2] ?? '', status: 'done' as const },
    ];

    await finalizeRun(ownerScope, runId, { outcomes });
    await finalizeRun(ownerScope, runId, { outcomes });

    await expect(getBalance(ownerScope)).resolves.toBe(80);
  });

  it('rejects a run belonging to another tenant', async () => {
    const { runId, itemIds } = await queueThreeCuts();

    await expect(
      finalizeRun({ ...ownerScope, orgId: 'org_2' }, runId, {
        outcomes: [{ itemId: itemIds[0] ?? '', status: 'done' }],
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
