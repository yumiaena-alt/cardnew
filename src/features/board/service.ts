import { findDefaultProjectId } from '@/features/deck/repository';
import { notFoundError } from '@/features/shared/errors';
import type { Scope } from '@/features/shared/scope';
import type { BoardRow, FanoutTarget } from '@/models/Board';
import type { SheetRowInput } from '@/validations/BoardValidation';
import { findOrCreateBoard, listBoardRows, replaceBoardRows } from './repository';

/**
 * Board persistence for the sheet.
 *
 * The sheet is a flat grid of strings and the table is typed rows, so this is
 * where one becomes the other. Keeping the translation in one place means the
 * load and save paths cannot disagree about what a column holds.
 */

/** The month a board covers, as the sheet addresses it. */
type Period = {
  periodStart: string;
  periodEnd: string;
};

/**
 * Returns the first and last day of the month containing a date.
 *
 * @param date - Any instant inside the target month, in UTC.
 * @returns The period bounds as ISO dates.
 */
/**
 * Formats a date as the `YYYY-MM-DD` the sheet and the date column both use.
 *
 * @param value - The date to format.
 * @returns The ISO date portion.
 */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthPeriod(date: Date): Period {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  return {
    periodStart: isoDate(new Date(Date.UTC(year, month, 1))),
    // Day zero of the next month is the last day of this one.
    periodEnd: isoDate(new Date(Date.UTC(year, month + 1, 0))),
  };
}

/**
 * Reads a stored row back into the flat shape the sheet renders.
 *
 * @param row - The stored row.
 * @returns The sheet row.
 */
function toSheetRow(row: BoardRow): Record<string, string> {
  const { notes } = row.cells;

  return {
    topic: row.topic,
    fanout: row.fanoutTargets.map((target) => target.channel).join(','),
    scheduledAt: row.scheduledAt ? isoDate(row.scheduledAt) : '',
    notes: typeof notes === 'string' ? notes : '',
  };
}

/**
 * Parses a sheet date cell, tolerating whatever the user typed.
 *
 * A sheet accepts free text, so an unparseable date is stored as no date rather
 * than failing the save and losing the rest of the user's edits.
 *
 * @param value - Raw cell value.
 * @returns The date, or null.
 */
function toScheduledAt(value: string): Date | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Loads the current month's board, creating it on first visit.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param now - The instant deciding which month is current.
 * @returns The board id and its rows in sheet shape.
 * @throws DomainError `not_found` when the organization has no default project.
 */
export async function loadCurrentBoard(
  scope: Scope,
  now: Date = new Date(),
): Promise<{ boardId: string; rows: Record<string, string>[] }> {
  const projectId = await findDefaultProjectId(scope);

  if (!projectId) {
    throw notFoundError(`Organization ${scope.orgId} has no default project`);
  }

  const board = await findOrCreateBoard(scope, {
    projectId,
    ...monthPeriod(now),
    createdBy: scope.userId,
  });

  const rows = await listBoardRows(scope, board.id);

  return { boardId: board.id, rows: rows.map(toSheetRow) };
}

/**
 * Writes the sheet back to the board.
 *
 * Empty rows are kept. A user who clears a row still expects the sheet to have
 * the same shape when they come back, and dropping blanks would silently
 * compact it under them.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param boardId - Board to write.
 * @param rows - The sheet's current rows.
 * @param channelRatios - Ratio to record per channel id.
 */
export async function saveBoard(
  scope: Scope,
  boardId: string,
  rows: SheetRowInput[],
  channelRatios: Partial<Record<string, FanoutTarget['ratio']>>,
): Promise<void> {
  await replaceBoardRows(
    scope,
    boardId,
    rows.map((row) => ({
      topic: row.topic,
      cells: { notes: row.notes },
      fanoutTargets: row.channels.flatMap((channel, index): FanoutTarget[] => {
        const ratio = channelRatios[channel];

        return ratio ? [{ channel, ratio, isOrigin: index === 0 }] : [];
      }),
      scheduledAt: toScheduledAt(row.scheduledAt),
    })),
  );
}
