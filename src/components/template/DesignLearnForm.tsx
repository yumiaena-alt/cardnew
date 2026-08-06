'use client';

import { ImagePlus, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import type { LearnFailureCode, LearnQuote } from '@/features/template/actions';
import { runDesignLearning } from '@/features/template/actions';
import { MAX_REFERENCE_IMAGES } from '@/features/template/learn';

type DesignLearnFormProps = {
  creditBalance: number;
};

/** The ratios a card can be learned for. Matches what generation can produce. */
const RATIOS = ['4:5', '1:1', '9:16', '16:9', '3:4'] as const;

/** Above this a browser struggles to read the file and the model refuses it. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reads a picked file as a data URL.
 *
 * The references are never uploaded. They are read once to learn a structure
 * and then let go — storing someone else's design because the pipeline happens
 * to move through storage would keep it for no reason anybody could name.
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
 * Turns reference designs into a template that can be generated from.
 *
 * @param props - The organization's credit balance, for the quote.
 * @returns The learning form.
 */
export function DesignLearnForm(props: DesignLearnFormProps) {
  const t = useTranslations('DesignLearnPage');
  const [name, setName] = useState('');
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>('4:5');
  const [images, setImages] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [quote, setQuote] = useState<LearnQuote | null>(null);
  const [failure, setFailure] = useState<LearnFailureCode | null>(null);
  const [learnedId, setLearnedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = name.trim() !== '' && images.length > 0;

  const addFiles = (files: FileList | null) => {
    if (!files) {
      return;
    }

    startTransition(async () => {
      const room = MAX_REFERENCE_IMAGES - images.length;
      const picked = [...files].filter((file) => file.size <= MAX_FILE_BYTES).slice(0, room);
      const urls = await Promise.all(picked.map(toDataUrl));

      setImages((previous) => [...previous, ...urls]);
      setQuote(null);
    });
  };

  const run = (dryRun: boolean) => {
    setFailure(null);
    setLearnedId(null);

    startTransition(async () => {
      const result = await runDesignLearning({
        name: name.trim(),
        ratio,
        images,
        ...(instruction.trim() === '' ? {} : { instruction: instruction.trim() }),
        rightsConfirmed,
        idempotencyKey: `learn:${name.trim()}:${images.length}:${ratio}`,
        dryRun,
      });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setQuote(result.quote);

      if (!result.dryRun) {
        setLearnedId(result.templateId);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Field htmlFor="learn-name" label={t('name_label')}>
        <Input
          id="learn-name"
          maxLength={60}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder={t('name_placeholder')}
          value={name}
        />
      </Field>

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

      <Field
        hint={t('images_hint', { max: MAX_REFERENCE_IMAGES })}
        htmlFor="learn-images"
        label={t('images_label', { count: images.length })}
      >
        <input
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          disabled={images.length >= MAX_REFERENCE_IMAGES}
          id="learn-images"
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

      <Field
        hint={t('instruction_hint')}
        htmlFor="learn-instruction"
        label={t('instruction_label')}
      >
        <Textarea
          id="learn-instruction"
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

      {learnedId ? (
        <p className="rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground">
          {t('learned')}
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
