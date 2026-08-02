import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgScope, Scope } from '@/features/shared/scope';
import type { Board, BoardRow, NewBoardRow } from '@/models/Board';

// The repository is faked so the tests exercise the translation between the
// flat sheet and typed rows, which is the part that can silently lose a user's
// month of work.
// oxlint-disable eslint/require-await -- the repository these doubles stand in
// for is async, so the signatures must match.
const store = vi.hoisted(() => ({
  boards: [] as Board[],
  rows: [] as BoardRow[],
  written: [] as Omit<NewBoardRow, 'boardId' | 'orgId' | 'position'>[],
  projectId: 'project_1' as string | null,
}));

vi.mock(import('@/features/deck/repository'), () => ({
  findDefaultProjectId: async () => store.projectId,
}));

vi.mock(import('./repository'), () => ({
  findOrCreateBoard: async (scope: OrgScope, input: { periodStart: string; periodEnd: string }) => {
    const existing = store.boards.find((board) => board.periodStart === input.periodStart);

    if (existing) {
      return existing;
    }

    const created: Board = {
      id: `board_${store.boards.length + 1}`,
      orgId: scope.orgId,
      projectId: 'project_1',
      title: input.periodStart,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      columnConfig: [],
      defaultFanout: [],
      createdBy: 'user_1',
      createdAt: new Date(),
      deletedAt: null,
    };

    store.boards.push(created);

    return created;
  },

  listBoardRows: async () => store.rows,

  replaceBoardRows: async (
    _scope: OrgScope,
    _boardId: string,
    rows: Omit<NewBoardRow, 'boardId' | 'orgId' | 'position'>[],
  ) => {
    store.written = rows;

    return [];
  },
}));

const { loadCurrentBoard, saveBoard } = await import('./service');

const scope: Scope = {
  orgId: 'org_1',
  userId: 'user_1',
  clerkOrgId: 'org_clerk',
  clerkUserId: 'user_clerk',
  role: 'owner',
  planKey: 'standard',
};

const RATIOS = { instagram: '4:5', tiktok: '9:16', threads: '1:1' } as const;

function sheetRow(overrides: Partial<Parameters<typeof saveBoard>[2][number]> = {}) {
  return { topic: '여름 신메뉴 소개', channels: [], scheduledAt: '', notes: '', ...overrides };
}

// Builds a complete stored row, so a test seeds state without a partial cast.
function storedRow(overrides: Partial<BoardRow>): BoardRow {
  return {
    id: 'row_1',
    boardId: 'board_1',
    orgId: 'org_1',
    position: 1000,
    topic: '',
    cells: {},
    fanoutTargets: [],
    scheduledAt: null,
    status: 'draft',
    estimatedCredits: 0,
    lastRunId: null,
    errorMessage: null,
    ...overrides,
  };
}

function resetStore() {
  store.boards = [];
  store.rows = [];
  store.written = [];
  store.projectId = 'project_1';
}

describe(loadCurrentBoard, () => {
  beforeEach(resetStore);

  it('addresses the board by the month it covers', async () => {
    await loadCurrentBoard(scope, new Date('2026-08-17T09:00:00Z'));

    expect(store.boards[0]).toMatchObject({
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });
  });

  it('ends February on its real last day', async () => {
    await loadCurrentBoard(scope, new Date('2026-02-10T00:00:00Z'));

    expect(store.boards[0]?.periodEnd).toBe('2026-02-28');
  });

  it('returns the same board on a second visit in the month', async () => {
    const first = await loadCurrentBoard(scope, new Date('2026-08-01T00:00:00Z'));
    const second = await loadCurrentBoard(scope, new Date('2026-08-28T23:00:00Z'));

    expect(second.boardId).toBe(first.boardId);
    expect(store.boards).toHaveLength(1);
  });

  it('reads stored rows back into the flat sheet shape', async () => {
    store.rows = [
      storedRow({
        topic: '여름 신메뉴 소개',
        fanoutTargets: [
          { channel: 'instagram', ratio: '4:5', isOrigin: true },
          { channel: 'tiktok', ratio: '9:16', isOrigin: false },
        ],
        scheduledAt: new Date('2026-08-14T00:00:00Z'),
        cells: { notes: '사진 먼저 확인' },
      }),
    ];

    const board = await loadCurrentBoard(scope, new Date('2026-08-01T00:00:00Z'));

    expect(board.rows[0]).toStrictEqual({
      topic: '여름 신메뉴 소개',
      fanout: 'instagram,tiktok',
      scheduledAt: '2026-08-14',
      notes: '사진 먼저 확인',
    });
  });

  it('refuses when the organization has no default project', async () => {
    store.projectId = null;

    await expect(loadCurrentBoard(scope)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe(saveBoard, () => {
  beforeEach(resetStore);

  it('marks the first selected channel as the origin', async () => {
    await saveBoard(scope, 'board_1', [sheetRow({ channels: ['tiktok', 'instagram'] })], RATIOS);

    expect(store.written[0]?.fanoutTargets).toStrictEqual([
      { channel: 'tiktok', ratio: '9:16', isOrigin: true },
      { channel: 'instagram', ratio: '4:5', isOrigin: false },
    ]);
  });

  it('drops a channel it has no ratio for rather than storing a broken target', async () => {
    await saveBoard(scope, 'board_1', [sheetRow({ channels: ['instagram', 'blog'] })], RATIOS);

    expect(store.written[0]?.fanoutTargets).toHaveLength(1);
  });

  it('keeps an empty row so the sheet does not compact under the user', async () => {
    await saveBoard(scope, 'board_1', [sheetRow(), sheetRow({ topic: '' }), sheetRow()], RATIOS);

    expect(store.written).toHaveLength(3);
  });

  it('stores a typed date', async () => {
    await saveBoard(scope, 'board_1', [sheetRow({ scheduledAt: '2026-08-14' })], RATIOS);

    expect(store.written[0]?.scheduledAt).toStrictEqual(new Date('2026-08-14'));
  });

  it('stores no date when the cell is blank', async () => {
    await saveBoard(scope, 'board_1', [sheetRow({ scheduledAt: '   ' })], RATIOS);

    expect(store.written[0]?.scheduledAt).toBeNull();
  });

  // A sheet cell accepts anything the user types. Rejecting the save would lose
  // every other edit in the batch over one malformed date.
  it('stores no date when the cell cannot be parsed', async () => {
    await saveBoard(scope, 'board_1', [sheetRow({ scheduledAt: '다음 주 화요일' })], RATIOS);

    expect(store.written[0]?.scheduledAt).toBeNull();
  });

  it('keeps notes in the cell bag', async () => {
    await saveBoard(scope, 'board_1', [sheetRow({ notes: '사진 먼저 확인' })], RATIOS);

    expect(store.written[0]?.cells).toStrictEqual({ notes: '사진 먼저 확인' });
  });
});
