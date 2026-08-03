import { setRequestLocale } from 'next-intl/server';
import { PlanningView } from '@/components/planning/PlanningView';
import { loadCurrentBoard } from '@/features/board/service';
import { findScope } from '@/features/shared/scope';

type PlanningPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PlanningPage(props: PlanningPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  // Only the count is read here. Planning shows how full the month already is
  // so a user can see whether they need twelve more ideas or two.
  const scope = await findScope();
  const board = scope ? await loadCurrentBoard(scope) : null;
  const boardRowCount = board
    ? board.rows.filter((row) => (row.topic ?? '').trim() !== '').length
    : 0;

  return <PlanningView boardRowCount={boardRowCount} />;
}
