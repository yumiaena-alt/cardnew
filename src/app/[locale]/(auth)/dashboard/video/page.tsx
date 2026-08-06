import { Clapperboard } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeckVideoPanel } from '@/components/deck/DeckVideoPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { listDecks } from '@/features/deck/repository';
import { findDeckVideoUrl } from '@/features/deck/video';
import { findScope } from '@/features/shared/scope';

type VideoPageProps = {
  params: Promise<{ locale: string }>;
};

/** Enough of the back catalogue to find the one you meant. */
const DECK_LIMIT = 20;

/**
 * Reels, entered from the reel rather than from the card news.
 *
 * The same panel lives on each card news, which is the right place when you are
 * already looking at one. This is the other way round: you want a video and do
 * not remember which card news it came from. Nothing here generates footage —
 * a reel is our own cards moving, so it starts from cards that exist.
 *
 * @param props - Route params carrying the locale.
 * @returns The video screen.
 */
export default async function VideoPage(props: VideoPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'VideoPage' });
  const scope = await findScope();
  const decks = scope ? await listDecks(scope, DECK_LIMIT) : [];

  const withVideos = await Promise.all(
    decks.map(async (deck) => ({
      deck,
      videoUrl: scope ? await findDeckVideoUrl(scope, deck.id) : null,
    })),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {withVideos.length === 0 ? (
        <EmptyState
          description={t('empty_description')}
          icon={Clapperboard}
          title={t('empty_title')}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {withVideos.map((entry) => (
            <li className="flex flex-col gap-2" key={entry.deck.id}>
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-medium text-foreground">{entry.deck.title}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('panels', { count: entry.deck.panelCount })}
                </span>
              </div>

              <DeckVideoPanel
                deckId={entry.deck.id}
                hasRenderedCards={entry.deck.panelCount > 0}
                videoUrl={entry.videoUrl}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
