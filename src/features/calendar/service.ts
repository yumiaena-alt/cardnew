import { loadCurrentBoard } from '@/features/board/service';
import type { Scope } from '@/features/shared/scope';

/**
 * The publishing month, as a calendar.
 *
 * Built from the board rather than from a table of its own. The board is where
 * a month is decided, so a calendar with its own store would be a second answer
 * to the same question — and the two would disagree the first time someone
 * edited one of them.
 */

type CalendarEntry = {
  topic: string;
  channels: string[];
};

export type CalendarDay = {
  /** ISO date. The key the grid renders against. */
  date: string;
  dayOfMonth: number;
  entries: CalendarEntry[];
};

export type CalendarMonth = {
  year: number;
  /** 1-based, as a person would say it. */
  month: number;
  /** Blank cells before the first day, so the grid starts on the right weekday. */
  leadingBlanks: number;
  days: CalendarDay[];
  scheduledCount: number;
  /** Rows with a topic but no date. The work that would silently never go out. */
  unscheduledCount: number;
};

/**
 * Formats a date as the ISO day the grid keys on.
 *
 * @param value - The date to format.
 * @returns The `YYYY-MM-DD` portion.
 */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Builds the publishing calendar for the current month.
 *
 * Days are generated for the whole month, including empty ones. An empty day is
 * the point of this screen — it is what the monthly batch session exists to
 * fill — so it has to be a cell, not a gap.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param now - The instant deciding which month is shown.
 * @returns The month, its days, and what is still unscheduled.
 */
export async function loadCalendarMonth(
  scope: Scope,
  now: Date = new Date(),
): Promise<CalendarMonth> {
  const board = await loadCurrentBoard(scope, now);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const byDate = new Map<string, CalendarEntry[]>();
  let unscheduledCount = 0;

  for (const row of board.rows) {
    const topic = (row.topic ?? '').trim();

    if (topic === '') {
      continue;
    }

    const date = (row.scheduledAt ?? '').trim();

    if (date === '') {
      unscheduledCount += 1;
      continue;
    }

    const entry: CalendarEntry = {
      topic,
      channels: (row.fanout ?? '').split(',').filter((channel) => channel !== ''),
    };

    byDate.set(date, [...(byDate.get(date) ?? []), entry]);
  }

  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const days: CalendarDay[] = Array.from({ length: dayCount }, (_, index) => {
    const date = isoDate(new Date(Date.UTC(year, month, index + 1)));

    return { date, dayOfMonth: index + 1, entries: byDate.get(date) ?? [] };
  });

  return {
    year,
    month: month + 1,
    leadingBlanks: new Date(Date.UTC(year, month, 1)).getUTCDay(),
    days,
    scheduledCount: [...byDate.values()].reduce((total, entries) => total + entries.length, 0),
    unscheduledCount,
  };
}
