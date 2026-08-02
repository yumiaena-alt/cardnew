'use client';

import { Redo2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { CreditBadge } from '@/components/ui/CreditBadge';
import { estimateBoardCredits } from '@/features/credit/estimate';
import type { RunActionResult, RunFailureCode } from '@/features/run/actions';
import { submitRun } from '@/features/run/actions';
import type { RunEstimate } from '@/features/run/estimate';
import { BoardCardList } from './BoardCardList';
import { BoardGrid } from './BoardGrid';
import { DryRunPanel } from './DryRunPanel';
import type { FanoutChannelId } from './FanoutCell';
import { parseFanout } from './FanoutCell';
import { toRunItems } from './runInput';
import type { SheetColumn, SheetRow } from './useBoardSheet';
import { useBoardSheet } from './useBoardSheet';

const BOARD_COLUMNS: readonly SheetColumn[] = [
  { key: 'topic', labelKey: 'column_topic', width: 320 },
  { key: 'fanout', labelKey: 'column_fanout', width: 300 },
  { key: 'scheduledAt', labelKey: 'column_scheduled', width: 160 },
  { key: 'notes', labelKey: 'column_notes', width: 240 },
];

type BoardViewProps = {
  initialRows: readonly SheetRow[];
  creditBalance: number;
};

/**
 * Board screen: a spreadsheet on wide viewports, stacked cards below `lg`.
 * Shows a live credit estimate so the cost of a run is visible before it starts.
 *
 * @param props - Seed rows and the current credit balance.
 * @returns The board view.
 */
export function BoardView(props: BoardViewProps) {
  const t = useTranslations('BoardPage');
  const sheet = useBoardSheet({ columns: BOARD_COLUMNS, initialRows: props.initialRows });
  const [isPending, startTransition] = useTransition();
  const [quote, setQuote] = useState<RunEstimate | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [failureCode, setFailureCode] = useState<RunFailureCode | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  // Held across the confirm so a double submit reuses the key and the server
  // returns the run it already created instead of charging a second time.
  const [runKey, setRunKey] = useState('');

  const applyResult = (result: RunActionResult) => {
    if (!result.ok) {
      setFailureCode(result.code);

      return;
    }

    if (result.dryRun) {
      setQuote(result.estimate);

      return;
    }

    // The modal stays open on success. Generation is asynchronous, so closing
    // here would leave the user with no sign anything happened.
    setStartedRunId(result.runId);
  };

  const requestQuote = () => {
    const key = crypto.randomUUID();

    setRunKey(key);
    setQuote(null);
    setFailureCode(null);
    setStartedRunId(null);
    setPanelOpen(true);

    startTransition(async () => {
      applyResult(
        await submitRun({
          items: toRunItems(sheet.rows),
          scope: { kind: 'full' },
          idempotencyKey: key,
          dryRun: true,
        }),
      );
    });
  };

  const confirmRun = () => {
    setFailureCode(null);

    startTransition(async () => {
      applyResult(
        await submitRun({
          items: toRunItems(sheet.rows),
          scope: { kind: 'full' },
          idempotencyKey: runKey,
          dryRun: false,
        }),
      );
    });
  };

  const columnLabels: Record<string, string> = {
    topic: t('column_topic'),
    fanout: t('column_fanout'),
    scheduledAt: t('column_scheduled'),
    notes: t('column_notes'),
  };

  const channelLabels: Record<FanoutChannelId, string> = {
    instagram: t('channel_instagram'),
    threads: t('channel_threads'),
    tiktok: t('channel_tiktok'),
    blog: t('channel_blog'),
  };

  const estimate = estimateBoardCredits(
    sheet.rows.map((row) => ({
      hasTopic: (row.topic ?? '').trim() !== '',
      channelCount: parseFanout(row.fanout ?? '').length,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('summary', { rows: estimate.rowCount, cuts: estimate.cutCount })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t('undo')}
            disabled={!sheet.canUndo}
            onClick={sheet.undoEdit}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t('redo')}
            disabled={!sheet.canRedo}
            onClick={sheet.redoEdit}
          >
            <Redo2 />
          </Button>
          <CreditBadge balance={props.creditBalance} estimate={estimate.total} />
          <Button
            variant="signal"
            size="lg"
            disabled={estimate.total === 0 || isPending}
            onClick={requestQuote}
          >
            {t('run', { count: estimate.cutCount + estimate.originCount })}
          </Button>
        </div>
      </header>

      <DryRunPanel
        open={isPanelOpen}
        onOpenChange={setPanelOpen}
        estimate={quote}
        balance={props.creditBalance}
        failureCode={failureCode}
        isPending={isPending}
        startedRunId={startedRunId}
        onConfirm={confirmRun}
      />

      <div className="hidden lg:block">
        <BoardGrid
          sheet={sheet}
          columns={BOARD_COLUMNS}
          columnLabels={columnLabels}
          channelLabels={channelLabels}
        />
      </div>

      <div className="lg:hidden">
        <BoardCardList
          sheet={sheet}
          columns={BOARD_COLUMNS}
          columnLabels={columnLabels}
          channelLabels={channelLabels}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t('keyboard_hint')}</p>
    </div>
  );
}
