import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scope } from '@/features/shared/scope';

// The board load is faked so these tests are about the calendar's own maths —
// month boundaries and which rows land where — rather than about persistence.
const board = vi.hoisted(() => ({ rows: [] as Record<string, string>[] }));

// oxlint-disable eslint/require-await -- these doubles stand in for async
// repository calls, so their signatures must match even though the canned
// values they return resolve synchronously.
vi.mock(import('@/features/board/service'), () => ({
  loadCurrentBoard: async () => ({ boardId: 'board_1', rows: board.rows }),
  saveBoard: async () => {
    // Never called here; present so the mocked module matches the real one.
  },
}));

const { loadCalendarMonth } = await import('./service');

const scope: Scope = {
  orgId: 'org_1',
  userId: 'user_1',
  clerkOrgId: 'org_clerk',
  clerkUserId: 'user_clerk',
  role: 'owner',
  planKey: 'standard',
};

function row(overrides: Record<string, string>) {
  return { topic: '', fanout: '', scheduledAt: '', notes: '', ...overrides };
}

describe(loadCalendarMonth, () => {
  beforeEach(() => {
    board.rows = [];
  });

  describe('month shape', () => {
    it('generates a cell for every day of the month', async () => {
      const month = await loadCalendarMonth(scope, new Date('2026-08-15T00:00:00Z'));

      expect(month.days).toHaveLength(31);
    });

    it('handles a short month', async () => {
      const month = await loadCalendarMonth(scope, new Date('2026-02-15T00:00:00Z'));

      expect(month.days).toHaveLength(28);
    });

    it('offsets the grid so the first day lands on its weekday', async () => {
      // 1 August 2026 is a Saturday.
      const month = await loadCalendarMonth(scope, new Date('2026-08-15T00:00:00Z'));

      expect(month.leadingBlanks).toBe(6);
    });

    it('reports the month the way a person says it', async () => {
      const month = await loadCalendarMonth(scope, new Date('2026-08-15T00:00:00Z'));

      expect(month).toMatchObject({ year: 2026, month: 8 });
    });
  });

  describe('placing rows', () => {
    it('puts a row on its scheduled day', async () => {
      board.rows = [row({ topic: '여름 신메뉴', scheduledAt: '2026-08-14' })];

      const month = await loadCalendarMonth(scope, new Date('2026-08-01T00:00:00Z'));

      expect(month.days[13]?.entries).toStrictEqual([{ topic: '여름 신메뉴', channels: [] }]);
    });

    it('keeps several rows on one day', async () => {
      board.rows = [
        row({ topic: '아침 공지', scheduledAt: '2026-08-14' }),
        row({ topic: '저녁 공지', scheduledAt: '2026-08-14' }),
      ];

      const month = await loadCalendarMonth(scope, new Date('2026-08-01T00:00:00Z'));

      expect(month.days[13]?.entries).toHaveLength(2);
    });

    it('carries the channels a row fans out to', async () => {
      board.rows = [
        row({ topic: '여름 신메뉴', scheduledAt: '2026-08-14', fanout: 'instagram,tiktok' }),
      ];

      const month = await loadCalendarMonth(scope, new Date('2026-08-01T00:00:00Z'));

      expect(month.days[13]?.entries[0]?.channels).toStrictEqual(['instagram', 'tiktok']);
    });

    it('ignores a row with no topic', async () => {
      board.rows = [row({ scheduledAt: '2026-08-14' })];

      const month = await loadCalendarMonth(scope, new Date('2026-08-01T00:00:00Z'));

      expect(month.scheduledCount).toBe(0);
    });

    // A topic with no date is work that would quietly never go out, which is
    // exactly what a planning calendar is supposed to surface.
    it('counts a dated-less topic as unscheduled rather than dropping it', async () => {
      board.rows = [row({ topic: '언젠가 쓸 소재' })];

      const month = await loadCalendarMonth(scope, new Date('2026-08-01T00:00:00Z'));

      expect(month).toMatchObject({ unscheduledCount: 1, scheduledCount: 0 });
    });

    it('leaves days outside the month out of the grid', async () => {
      board.rows = [row({ topic: '다음 달 소재', scheduledAt: '2026-09-03' })];

      const month = await loadCalendarMonth(scope, new Date('2026-08-01T00:00:00Z'));

      expect(month.days.every((day) => day.entries.length === 0)).toBeTruthy();
    });
  });
});
