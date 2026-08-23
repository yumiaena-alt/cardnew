'use client';

import { ImagePlus, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { ToonFailureCode, ToonQuote } from '@/features/toon/actions';
import { learnToonFormula } from '@/features/toon/actions';
import { MAX_FORMULA_REFERENCES } from '@/lib/toon/analyze';

/**
 * Turning reference instatoons into a reusable story formula.
 *
 * What comes back is a beat sheet, not a story: how many cuts, what each one
 * is for, where the tension rises. The references are read once and dropped —
 * they are somebody else's comic, and the structure is the only part of them
 * that is ours to reuse.
 */

/** Above this a browser struggles to read the file and the model refuses it. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type FormulaLearnFormProps = {
  creditBalance: number;
};

/**
 * Reads a picked file as a data URL.
 *
 * @param file - The picked file.
 * @returns The data URL.
 */
async function toDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }

  return `data:${file.type};base64,${btoa(binary)}`;
}

/**
 * Quotes and runs a benchmark analysis.
 *
 * @param props - The organization's credit balance, for the quote.
 * @returns The analysis form.
 */
export function FormulaLearnForm(props: FormulaLearnFormProps) {
  const t = useTranslations('ToonFormulasPage');
  const [name, setName] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [instruction, setInstruction] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [quote, setQuote] = useState<ToonQuote | null>(null);
  const [failure, setFailure] = useState<ToonFailureCode | null>(null);
  const [learned, setLearned] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const ready = name.trim() !== '' && images.length > 0;

  const addFiles = (files: FileList | null) => {
    if (!files) {
      return;
    }

    startTransition(async () => {
      const room = MAX_FORMULA_REFERENCES - images.length;
      const picked = [...files].filter((file) => file.size <= MAX_FILE_BYTES).slice(0, room);
      const urls = await Promise.all(picked.map(toDataUrl));

      setImages((previous) => [...previous, ...urls]);
      setQuote(null);
    });
  };

  const run = (dryRun: boolean) => {
    setFailure(null);
    setLearned(false);
    setWarnings([]);

    startTransition(async () => {
      const result = await learnToonFormula({
        name: name.trim(),
        images,
        notes: notes.trim() === '' ? null : notes.trim(),
        instruction: instruction.trim() === '' ? null : instruction.trim(),
        rightsConfirmed,
        idempotencyKey: `toon-formula:${name.trim()}:${images.length}`,
        dryRun,
      });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setQuote(result.quote);

      if (!result.dryRun) {
        setLearned(true);
        setWarnings(result.warnings);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Field htmlFor="formula-name" label={t('name_label')}>
        <Input
          id="formula-name"
          maxLength={60}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder={t('name_placeholder')}
          value={name}
        />
      </Field>

      <Field
        hint={t('images_hint', { max: MAX_FORMULA_REFERENCES })}
        htmlFor="formula-images"
        label={t('images_label', { count: images.length })}
      >
        <input
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          disabled={images.length >= MAX_FORMULA_REFERENCES}
          id="formula-images"
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
          }}
          type="file"
        />
      </Field>

      {images.length > 0 ? (
        <ul className="grid grid-cols-5 gap-2">
          {images.map((image, index) => (
            <li className="relative" key={image.slice(-40)}>
              {/** biome-ignore lint/performance/noImgElement: local data URLs, never optimised */}
              <img
                alt={t('reference_alt', { index: index + 1 })}
                className="aspect-square w-full rounded-md border border-border object-cover"
                src={image}
              />

              <button
                aria-label={t('remove_reference')}
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setImages((previous) => previous.filter((_, at) => at !== index));
                  setQuote(null);
                }}
                type="button"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Field htmlFor="formula-notes" hint={t('notes_hint')} label={t('notes_label')}>
        <Textarea
          id="formula-notes"
          maxLength={2000}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          placeholder={t('notes_placeholder')}
          rows={3}
          value={notes}
        />
      </Field>

      <Field
        htmlFor="formula-instruction"
        hint={t('instruction_hint')}
        label={t('instruction_label')}
      >
        <Textarea
          id="formula-instruction"
          maxLength={500}
          onChange={(event) => {
            setInstruction(event.target.value);
          }}
          placeholder={t('instruction_placeholder')}
          rows={2}
          value={instruction}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
        <input
          checked={rightsConfirmed}
          className="mt-0.5 size-4 accent-signal"
          onChange={(event) => {
            setRightsConfirmed(event.target.checked);
          }}
          type="checkbox"
        />
        <span className="text-foreground">{t('rights_label')}</span>
      </label>

      {quote ? (
        <div className="flex items-center justify-between rounded-lg border border-secondary bg-secondary p-3 text-sm">
          <span className="text-foreground">{t('quote', { credits: quote.credits })}</span>
          <span className="text-muted-foreground tabular-nums">
            {t('balance', { balance: quote.balance })}
          </span>
        </div>
      ) : null}

      {failure ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {t(`error_${failure}`)}
        </p>
      ) : null}

      {learned ? (
        <p className="rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground">
          {t('learned')}
        </p>
      ) : null}

      {/* A hook pattern that reads as a finished sentence is usually a line
          lifted from the reference. Shown rather than silently kept, because
          the person who supplied the reference is the one who can tell. */}
      {warnings.length > 0 ? (
        <p className="rounded-lg border border-status-wait-border bg-status-wait p-3 text-sm text-status-wait-foreground">
          {t('verbatim_warning', { count: warnings.length })}
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
          <ImagePlus data-icon="inline-start" />
          {t('quote_action')}
        </Button>

        {/* Only offered once a price has been shown. Nothing here may take
            credits from someone who has not seen what it costs. */}
        <Button
          disabled={!(ready && rightsConfirmed && quote?.affordable) || isPending}
          onClick={() => {
            run(false);
          }}
          size="lg"
          variant="signal"
        >
          <Sparkles data-icon="inline-start" />
          {isPending ? t('learning') : t('learn_action', { credits: props.creditBalance })}
        </Button>
      </div>
    </div>
  );
}
