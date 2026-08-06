'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { DryRunPanel } from '@/components/board/DryRunPanel';
import type { FanoutChannelId } from '@/components/board/FanoutCell';
import { FANOUT_CHANNELS } from '@/components/board/FanoutCell';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import type { RunActionResult, RunFailureCode } from '@/features/run/actions';
import { submitRun } from '@/features/run/actions';
import type { RunEstimate } from '@/features/run/estimate';
import type { RunItemInput } from '@/validations/RunValidation';

type DeckCreateFormProps = {
  creditBalance: number;
  /** Styles this organization has learned, newest first. Empty is normal. */
  templates: { id: string; versionId: string; name: string }[];
};

const TOPIC_FIELD_ID = 'deck-topic';

/**
 * Single-deck creation.
 *
 * Runs through the same entry point as the board: a single deck is a run of one
 * item. That is deliberate — a separate single-deck path would be a second
 * place where credits are charged, and the two would drift.
 *
 * @param props - The organization's current credit balance.
 * @returns The creation form.
 */
export function DeckCreateForm(props: DeckCreateFormProps) {
  const t = useTranslations('DeckNewPage');
  const [topic, setTopic] = useState('');
  const [channel, setChannel] = useState<FanoutChannelId>('instagram');
  const [isPending, startTransition] = useTransition();
  const [quote, setQuote] = useState<RunEstimate | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [templateVersionId, setTemplateVersionId] = useState('');
  const [failureCode, setFailureCode] = useState<RunFailureCode | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const [runKey, setRunKey] = useState('');

  const target = FANOUT_CHANNELS.find((entry) => entry.id === channel) ?? FANOUT_CHANNELS[0];
  const canSubmit = topic.trim() !== '' && !isPending;

  const buildItems = (): RunItemInput[] => [
    {
      topic: topic.trim(),
      ...(templateVersionId === '' ? {} : { templateVersionId }),
      targets: [{ channel: target.id, ratio: target.ratio, isOrigin: true }],
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
          items: buildItems(),
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
          items: buildItems(),
          scope: { kind: 'full' },
          idempotencyKey: runKey,
          dryRun: false,
        }),
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <Field label={t('topic_label')} htmlFor={TOPIC_FIELD_ID} hint={t('topic_hint')}>
          <Textarea
            id={TOPIC_FIELD_ID}
            value={topic}
            placeholder={t('topic_placeholder')}
            maxLength={500}
            onChange={(event) => {
              setTopic(event.target.value);
            }}
          />
        </Field>

        <Field label={t('channel_label')} hint={t('channel_hint', { ratio: target.ratio })}>
          <Select
            aria-label={t('channel_label')}
            value={channel}
            onValueChange={(value) => {
              // Narrowed against the source of truth rather than asserted, so a
              // channel removed from FANOUT_CHANNELS cannot linger in state.
              const picked = FANOUT_CHANNELS.find((entry) => entry.id === value);

              if (picked) {
                setChannel(picked.id);
              }
            }}
            options={FANOUT_CHANNELS.map((entry) => ({
              value: entry.id,
              label: t(`channel_${entry.id}`),
            }))}
          />
        </Field>

        {/* Only offered when there is something to offer. A picker whose only
            entry is "none" is a control that teaches nothing. */}
        {props.templates.length > 0 ? (
          <Field hint={t('template_hint')} label={t('template_label')}>
            <Select
              aria-label={t('template_label')}
              onValueChange={setTemplateVersionId}
              options={[
                { value: '', label: t('template_none') },
                ...props.templates.map((entry) => ({ value: entry.versionId, label: entry.name })),
              ]}
              value={templateVersionId}
            />
          </Field>
        ) : null}

        <div className="flex justify-end">
          <Button variant="signal" size="lg" disabled={!canSubmit} onClick={requestQuote}>
            {t('submit')}
          </Button>
        </div>
      </div>

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
    </div>
  );
}
