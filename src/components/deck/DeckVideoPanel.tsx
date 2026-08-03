'use client';

import { Clapperboard, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { buildVideo } from '@/features/deck/actions';

type DeckVideoPanelProps = {
  deckId: string;
  /** Signed URL of a reel already built for this version, when there is one. */
  videoUrl: string | null;
  hasRenderedCards: boolean;
};

/**
 * The deck as a reel.
 *
 * Built on request rather than with every deck. Most decks go out as a carousel
 * and never need a video, and encoding one for each would spend the render
 * host's time on files nobody opens.
 *
 * @param props - The deck, any existing reel, and whether cards have rendered.
 * @returns The video panel.
 */
export function DeckVideoPanel(props: DeckVideoPanelProps) {
  const t = useTranslations('DeckVideoPanel');
  const [url, setUrl] = useState(props.videoUrl);
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Flattened out of the button: a nested ternary in JSX is where a label
  // silently ends up wrong.
  let buildLabel = t('build');

  if (isPending) {
    buildLabel = t('building');
  } else if (url) {
    buildLabel = t('rebuild');
  }

  const build = () => {
    setFailure(null);

    startTransition(async () => {
      const result = await buildVideo(props.deckId);

      if (result.ok) {
        setUrl(result.url);

        return;
      }

      setFailure(result.code);
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Button disabled={!props.hasRenderedCards || isPending} onClick={build} size="lg">
          <Clapperboard data-icon="inline-start" />
          {buildLabel}
        </Button>
      </header>

      {props.hasRenderedCards ? null : (
        <p className="rounded-lg border border-status-wait-border bg-status-wait p-3 text-sm text-status-wait-foreground">
          {t('no_cards')}
        </p>
      )}

      {failure ? (
        <p className="rounded-lg border border-status-fail-border bg-status-fail p-3 text-sm text-status-fail-foreground">
          {failure === 'unavailable' ? t('error_unavailable') : t('error_failed')}
        </p>
      ) : null}

      {url ? (
        <div className="flex flex-col items-start gap-3">
          {/* Muted and unautoplayed: this is a preview inside a working screen,
              not a feed. Sound starting by itself is never welcome here. */}
          <video
            aria-label={t('title')}
            className="w-full max-w-xs rounded-md border border-border"
            controls
            src={url}
          >
            <track kind="captions" />
          </video>

          <Button
            render={
              <a download href={url} rel="noreferrer noopener" target="_blank">
                <Download data-icon="inline-start" />
                {t('download')}
              </a>
            }
            size="lg"
            variant="outline"
          />
        </div>
      ) : null}
    </section>
  );
}
