import { setRequestLocale } from 'next-intl/server';
import { BoardView } from '@/components/board/BoardView';
import type { SheetRow } from '@/components/board/useBoardSheet';

type BoardPageProps = {
  params: Promise<{ locale: string }>;
};

/** Placeholder balance until the credit ledger lands in Phase 1-C. */
const PLACEHOLDER_CREDIT_BALANCE = 50;

/** Seed rows so the sheet is explorable before the board tables exist. */
const SEED_ROWS: SheetRow[] = Array.from({ length: 8 }, () => ({
  topic: '',
  fanout: 'instagram',
  scheduledAt: '',
  notes: '',
}));

export default async function BoardPage(props: BoardPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <BoardView initialRows={SEED_ROWS} creditBalance={PLACEHOLDER_CREDIT_BALANCE} />;
}
