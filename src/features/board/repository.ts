import { asc, eq } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { Board, BoardColumn, BoardRow, NewBoardRow } from '@/models/Board';
import { boardRows, boards } from '@/models/Board';

/**
 * Board and row access.
 *
 * Rows are replaced wholesale rather than diffed. A sheet edit can move, insert
 * and delete rows in one paste, so reconciling per row would need a stable id
 * the client does not have — and the working set is one month, which is small
 * enough that rewriting it is cheaper than getting the diff wrong.
 */

/** Sparse ordering so a later reorder rewrites one row instead of the sheet. */
const POSITION_STEP = 1000;

/** The sheet's columns. Stored on the board so a later column change is a data change. */
const DEFAULT_COLUMNS: BoardColumn[] = [
  { key: 'topic', label: 'topic', type: 'topic', width: 320, isRequired: true },
  { key: 'fanout', label: 'fanout', type: 'channel', width: 300, isRequired: true },
  { key: 'scheduledAt', label: 'scheduledAt', type: 'date', width: 160, isRequired: false },
  { key: 'notes', label: 'notes', type: 'text', width: 240, isRequired: false },
];

/**
 * Finds the organization's board for a period, creating it on first use.
 *
 * Boards are addressed by the month they cover rather than by an id the client
 * holds, so arriving at the sheet twice in one month lands on the same board.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - Owning project, the period, and who is creating it.
 * @returns The board for that period.
 */
export async function findOrCreateBoard(
  scope: OrgScope,
  input: { projectId: string; periodStart: string; periodEnd: string; createdBy: string },
): Promise<Board> {
  const [existing] = await db
    .select()
    .from(boards)
    .where(orgScoped(scope, boards, eq(boards.periodStart, input.periodStart)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(boards)
    .values({
      orgId: scope.orgId,
      projectId: input.projectId,
      title: input.periodStart,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      columnConfig: DEFAULT_COLUMNS,
      createdBy: input.createdBy,
    })
    .returning();

  if (!created) {
    throw new Error('Board insert returned no row');
  }

  return created;
}

/**
 * Lists a board's rows in sheet order.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param boardId - Board whose rows to read.
 * @returns The rows, ordered by position.
 */
export async function listBoardRows(scope: OrgScope, boardId: string): Promise<BoardRow[]> {
  return await db
    .select()
    .from(boardRows)
    .where(orgScoped(scope, boardRows, eq(boardRows.boardId, boardId)))
    .orderBy(asc(boardRows.position));
}

/**
 * Replaces every row of a board.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param boardId - Board to rewrite.
 * @param rows - Rows in sheet order, minus `boardId`, `orgId` and `position`.
 * @returns The stored rows.
 */
export async function replaceBoardRows(
  scope: OrgScope,
  boardId: string,
  rows: Omit<NewBoardRow, 'boardId' | 'orgId' | 'position'>[],
): Promise<BoardRow[]> {
  return await db.transaction(async (tx) => {
    await tx.delete(boardRows).where(orgScoped(scope, boardRows, eq(boardRows.boardId, boardId)));

    if (rows.length === 0) {
      return [];
    }

    return await tx
      .insert(boardRows)
      .values(
        rows.map((row, index) => ({
          ...row,
          boardId,
          orgId: scope.orgId,
          position: (index + 1) * POSITION_STEP,
        })),
      )
      .returning();
  });
}
