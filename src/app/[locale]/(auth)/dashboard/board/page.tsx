import { setRequestLocale } from 'next-intl/server';
import { BoardView } from '@/components/board/BoardView';
import type { SheetRow } from '@/components/board/useBoardSheet';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type BoardPageProps = {
  params: Promise<{ locale: string }>;
};

/** Seed rows so the sheet is explorable before boards are persisted. */
const SEED_ROWS: SheetRow[] = Array.from({ length: 8 }, () => ({
  topic: '',
  fanout: 'instagram',
  scheduledAt: '',
  notes: '',
}));

export default async function BoardPage(props: BoardPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  // The shell renders for a session whose organization has not been replicated
  // yet, so a missing scope shows a zero balance rather than an error page. The
  // run entry point resolves the scope again and refuses on its own.
  const scope = await findScope();
  const creditBalance = scope ? await getBalance(scope) : 0;

  return <BoardView initialRows={SEED_ROWS} creditBalance={creditBalance} />;
}
