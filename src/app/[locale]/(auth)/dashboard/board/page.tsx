import { setRequestLocale } from 'next-intl/server';
import { BoardView } from '@/components/board/BoardView';
import type { SheetRow } from '@/components/board/useBoardSheet';
import { loadCurrentBoard } from '@/features/board/service';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type BoardPageProps = {
  params: Promise<{ locale: string }>;
};

/** How many blank rows a fresh month opens with. Enough to paste into, not a wall. */
const SEED_ROW_COUNT = 8;

const BLANK_ROW: SheetRow = { topic: '', fanout: 'instagram', scheduledAt: '', notes: '' };

/**
 * Pads stored rows out to a workable sheet.
 *
 * A month that has been cleared down to two rows should still open with room
 * to type, but the stored rows come first so nothing the user wrote moves.
 *
 * @param rows - Rows loaded from the board.
 * @returns The rows the sheet renders.
 */
function withBlankRows(rows: SheetRow[]): SheetRow[] {
  if (rows.length >= SEED_ROW_COUNT) {
    return rows;
  }

  return [...rows, ...Array.from({ length: SEED_ROW_COUNT - rows.length }, () => BLANK_ROW)];
}

export default async function BoardPage(props: BoardPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  // The shell renders for a session whose organization has not been replicated
  // yet. Without a scope the sheet is still usable, just not persisted, and the
  // run entry point refuses on its own.
  const scope = await findScope();

  if (!scope) {
    return <BoardView initialRows={withBlankRows([])} creditBalance={0} boardId={null} />;
  }

  const [board, creditBalance] = await Promise.all([loadCurrentBoard(scope), getBalance(scope)]);

  return (
    <BoardView
      initialRows={withBlankRows(board.rows)}
      creditBalance={creditBalance}
      boardId={board.boardId}
    />
  );
}
