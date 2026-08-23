'use client';

import { Calculator, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import type { RunFailureCode } from '@/features/run/actions';
import { submitToonRun } from '@/features/toon/actions';
import { DEFAULT_TOON_CUTS, MAX_TOON_CUTS, MIN_TOON_CUTS } from '@/lib/toon/schema';

/**
 * Making one instatoon.
 *
 * Cut count is a control rather than a detail because it is what the run is
 * priced by — every cut is a drawn panel that costs money at the provider. The
 * quote is shown before anything is charged, the same as everywhere else that
 * spends credits.
 */

/** Ratios an instatoon is worth drawing at. Feed first, story second. */
const RATIOS = ['4:5', '1:1', '9:16'] as const;

/** Selectable cut counts, from the shortest story that works to the feed limit. */
const CUT_OPTIONS = Array.from(
  { length: MAX_TOON_CUTS - MIN_TOON_CUTS + 1 },
  (_, index) => index + MIN_TOON_CUTS,
);

type ToonOption = { id: string; name: string };

type ToonCreateFormProps = {
  characters: ToonOption[];
  formulas: ToonOption[];
  creditBalance: number;
  /** Label for the "no formula" choice, resolved on the server. */
  noFormulaLabel: string;
};

/**
 * Quotes and starts one instatoon.
 *
 * @param props - Characters, formulas, balance, and the empty-formula label.
 * @returns The creation form.
 */
export function ToonCreateForm(props: ToonCreateFormProps) {
  const t = useTranslations('ToonCreatePage');
  const [topic, setTopic] = useState('');
  const [characterId, setCharacterId] = useState(props.characters[0]?.id ?? '');
  const [formulaId, setFormulaId] = useState('');
  const [cutCount, setCutCount] = useState(DEFAULT_TOON_CUTS);
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>('4:5');
  const [credits, setCredits] = useState<number | null>(null);
  const [failure, setFailure] = useState<RunFailureCode | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = topic.trim() !== '' && characterId !== '';
  const affordable = credits !== null && props.creditBalance >= credits;

  const run = (dryRun: boolean) => {
    setFailure(null);
    setRunId(null);

    startTransition(async () => {
      const result = await submitToonRun({
        topic: topic.trim(),
        characterId,
        formulaId: formulaId === '' ? null : formulaId,
        cutCount,
        ratio,
        idempotencyKey: `toon:${characterId}:${cutCount}:${topic.trim()}`,
        dryRun,
      });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      if (result.dryRun) {
        setCredits(result.estimate.total);

        return;
      }

      setRunId(result.runId);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Field htmlFor="toon-topic" hint={t('topic_hint')} label={t('topic_label')}>
        <Textarea
          id="toon-topic"
          maxLength={500}
          onChange={(event) => {
            setTopic(event.target.value);
            setCredits(null);
          }}
          placeholder={t('topic_placeholder')}
          rows={3}
          value={topic}
        />
      </Field>

      <Field hint={t('character_hint')} label={t('character_label')}>
        <Select
          aria-label={t('character_label')}
          onValueChange={setCharacterId}
          options={props.characters.map((entry) => ({ value: entry.id, label: entry.name }))}
          value={characterId}
        />
      </Field>

      <Field hint={t('formula_hint')} label={t('formula_label')}>
        <Select
          aria-label={t('formula_label')}
          onValueChange={(value) => {
            setFormulaId(value);
            setCredits(null);
          }}
          options={[
            { value: '', label: props.noFormulaLabel },
            ...props.formulas.map((entry) => ({ value: entry.id, label: entry.name })),
          ]}
          value={formulaId}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">{t('cuts_label')}</legend>

        <div className="flex flex-wrap gap-2">
          {CUT_OPTIONS.map((count) => (
            <Button
              key={count}
              onClick={() => {
                setCutCount(count);
                setCredits(null);
              }}
              size="sm"
              variant={cutCount === count ? 'default' : 'outline'}
            >
              {t('cuts_option', { count })}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{t('cuts_hint')}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">{t('ratio_label')}</legend>

        <div className="flex flex-wrap gap-2">
          {RATIOS.map((entry) => (
            <Button
              key={entry}
              onClick={() => {
                setRatio(entry);
              }}
              size="sm"
              variant={ratio === entry ? 'default' : 'outline'}
            >
              {entry}
            </Button>
          ))}
        </div>
      </fieldset>

      {credits === null ? null : (
        <div className="flex items-center justify-between rounded-lg border border-secondary bg-secondary p-3 text-sm">
          <span className="text-foreground">{t('quote', { credits })}</span>
          <span className="text-muted-foreground tabular-nums">
            {t('balance', { balance: props.creditBalance })}
          </span>
        </div>
      )}

      {failure ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {t(`error_${failure}`)}
        </p>
      ) : null}

      {runId ? (
        <p className="rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground">
          {t('queued')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!ready || isPending}
          onClick={() => {
            run(true);
          }}
          size="lg"
          variant="outline"
        >
          <Calculator data-icon="inline-start" />
          {t('quote_action')}
        </Button>

        {/* Only offered once a price has been shown. Nothing here may take
            credits from someone who has not seen what it costs. */}
        <Button
          disabled={!(ready && affordable) || isPending}
          onClick={() => {
            run(false);
          }}
          size="lg"
          variant="signal"
        >
          <Sparkles data-icon="inline-start" />
          {isPending ? t('drawing') : t('create_action')}
        </Button>
      </div>
    </div>
  );
}
