'use client';

import { useState, useTransition } from 'react';
import { DryRunPanel } from '@/components/board/DryRunPanel';
import type { PanelView } from '@/features/deck/service';
import type { RunActionResult, RunFailureCode } from '@/features/run/actions';
import { submitRun } from '@/features/run/actions';
import type { RunEstimate } from '@/features/run/estimate';
import type { RunItemInput } from '@/validations/RunValidation';

type PanelRepaintProps = {
  /** The card to repaint. Null when the dialog is closed. */
  panel: PanelView | null;
  deckId: string;
  deckTopic: string;
  deckChannel: RunItemInput['targets'][number]['channel'];
  deckRatio: RunItemInput['targets'][number]['ratio'];
  creditBalance: number;
  onClose: () => void;
};

/**
 * Repaints one card, through the same quote-then-charge path as a full run.
 *
 * Deliberately not a direct action: a repaint spends credits, and every path
 * that spends credits shows its price first. That the price is small is not a
 * reason to skip the step — it is the habit that makes the expensive ones
 * trustworthy.
 *
 * @param props - The panel, its deck's context, and the close handler.
 * @returns The repaint dialog.
 */
export function PanelRepaint(props: PanelRepaintProps) {
  const [quote, setQuote] = useState<RunEstimate | null>(null);
  const [failureCode, setFailureCode] = useState<RunFailureCode | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const [runKey, setRunKey] = useState('');
  const [quotedFor, setQuotedFor] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const buildItems = (): RunItemInput[] => [
    {
      topic: props.deckTopic,
      deckId: props.deckId,
      targets: [{ channel: props.deckChannel, ratio: props.deckRatio, isOrigin: true }],
    },
  ];

  const applyResult = (result: RunActionResult) => {
    if (!result.ok) {
      setFailureCode(result.code);

      return;
    }

    if (result.dryRun) {
      setQuote(result.estimate);

      return;
    }

    setStartedRunId(result.runId);
  };

  const submit = (key: string, dryRun: boolean) => {
    const { panel } = props;

    if (!panel) {
      return;
    }

    startTransition(async () => {
      applyResult(
        await submitRun({
          items: buildItems(),
          scope: { kind: 'panel', panelIndex: panel.index },
          idempotencyKey: key,
          dryRun,
        }),
      );
    });
  };

  // Quoting on open rather than in an effect: opening is an event, and deriving
  // it during render keeps the dialog in step with the panel it was given.
  if (props.panel && props.panel.id !== quotedFor) {
    const key = crypto.randomUUID();

    setQuotedFor(props.panel.id);
    setRunKey(key);
    setQuote(null);
    setFailureCode(null);
    setStartedRunId(null);
    submit(key, true);
  }

  return (
    <DryRunPanel
      open={props.panel !== null}
      onOpenChange={(open) => {
        if (!open) {
          setQuotedFor(null);
          props.onClose();
        }
      }}
      estimate={quote}
      balance={props.creditBalance}
      failureCode={failureCode}
      isPending={isPending}
      startedRunId={startedRunId}
      onConfirm={() => {
        setFailureCode(null);
        submit(runKey, false);
      }}
    />
  );
}
