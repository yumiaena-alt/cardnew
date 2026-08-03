'use client';

import { Link2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { DryRunPanel } from '@/components/board/DryRunPanel';
import type { FanoutChannelId } from '@/components/board/FanoutCell';
import { FANOUT_CHANNELS } from '@/components/board/FanoutCell';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import type { IngestActionResult } from '@/features/ingest/actions';
import { readArticle } from '@/features/ingest/actions';
import type { Article } from '@/features/ingest/fetchArticle';
import type { RunActionResult, RunFailureCode } from '@/features/run/actions';
import { submitRun } from '@/features/run/actions';
import type { RunEstimate } from '@/features/run/estimate';

type LinkImportFormProps = {
  creditBalance: number;
};

const URL_FIELD_ID = 'link-url';

/** What the planner is handed. Past this it pays for filler, not for substance. */
const TOPIC_LENGTH = 480;

type IngestCode = Extract<IngestActionResult, { ok: false }>['code'];

/**
 * Turns a link into card news.
 *
 * Reading the link and generating from it are separate steps on purpose. Plenty
 * of links cannot be read — private posts, blocked crawlers, pages that are
 * mostly script — and finding that out should not cost anything or leave the
 * user staring at a failure after a charge.
 *
 * @param props - The organization's current credit balance.
 * @returns The link import form.
 */
export function LinkImportForm(props: LinkImportFormProps) {
  const t = useTranslations('DeckLinkPage');
  const [url, setUrl] = useState('');
  const [article, setArticle] = useState<Article | null>(null);
  const [ingestError, setIngestError] = useState<IngestCode | null>(null);
  const [channel, setChannel] = useState<FanoutChannelId>('instagram');
  const [isReading, startReading] = useTransition();
  const [isRunning, startRunning] = useTransition();
  const [quote, setQuote] = useState<RunEstimate | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [failureCode, setFailureCode] = useState<RunFailureCode | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const [runKey, setRunKey] = useState('');

  const target = FANOUT_CHANNELS.find((entry) => entry.id === channel) ?? FANOUT_CHANNELS[0];

  const read = () => {
    setIngestError(null);
    setArticle(null);

    startReading(async () => {
      const result = await readArticle(url);

      if (result.ok) {
        setArticle(result.article);

        return;
      }

      setIngestError(result.code);
    });
  };

  const buildItems = () => {
    const source = article ? `${article.title}\n\n${article.text}` : '';

    return [
      {
        topic: source.slice(0, TOPIC_LENGTH),
        targets: [{ channel: target.id, ratio: target.ratio, isOrigin: true }],
      },
    ];
  };

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

    startRunning(async () => {
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

    startRunning(async () => {
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
        <Field label={t('url_label')} htmlFor={URL_FIELD_ID} hint={t('url_hint')}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={URL_FIELD_ID}
              value={url}
              maxLength={2000}
              placeholder={t('url_placeholder')}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
            />

            <Button
              variant="outline"
              size="lg"
              disabled={url.trim() === '' || isReading}
              onClick={read}
            >
              <Link2 data-icon="inline-start" />
              {isReading ? t('reading') : t('read')}
            </Button>
          </div>
        </Field>

        {ingestError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {t(`error_${ingestError}`)}
          </p>
        ) : null}

        {article ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {article.title === '' ? t('untitled') : article.title}
            </h2>
            <p className="line-clamp-6 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {article.text}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('extracted', { count: article.text.length })}
            </p>
          </div>
        ) : null}
      </div>

      {article ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <Field label={t('channel_label')} hint={t('channel_hint', { ratio: target.ratio })}>
            <Select
              aria-label={t('channel_label')}
              value={channel}
              onValueChange={(value) => {
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

          <div className="flex justify-end">
            <Button variant="signal" size="lg" disabled={isRunning} onClick={requestQuote}>
              <Sparkles data-icon="inline-start" />
              {t('submit')}
            </Button>
          </div>
        </div>
      ) : null}

      <DryRunPanel
        open={isPanelOpen}
        onOpenChange={setPanelOpen}
        estimate={quote}
        balance={props.creditBalance}
        failureCode={failureCode}
        isPending={isRunning}
        startedRunId={startedRunId}
        onConfirm={confirmRun}
      />
    </div>
  );
}
