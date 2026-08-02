import { Images } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DeckSummary } from '@/features/deck/repository';
import { Link } from '@/libs/I18nNavigation';

type DeckCardProps = {
  deck: DeckSummary;
};

/** Aspect classes per ratio. Set on the thumbnail so a list of mixed cuts stays legible. */
const RATIO_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
  '3:4': 'aspect-[3/4]',
};

/**
 * One deck in the list.
 *
 * The thumbnail is a shaped placeholder rather than the first panel: the list
 * would otherwise sign one URL per deck on every render, which turns a page
 * view into dozens of storage round trips.
 *
 * @param props - The deck summary to render.
 * @returns The deck list card.
 */
export function DeckCard(props: DeckCardProps) {
  const t = useTranslations('DeckListPage');

  return (
    <Link
      href={`/dashboard/deck/${props.deck.id}`}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div
        className={`grid w-full place-items-center rounded-md bg-muted text-muted-foreground ${RATIO_CLASS[props.deck.ratio] ?? 'aspect-[4/5]'}`}
      >
        <Images className="size-6" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground">{props.deck.title}</h3>
        <p className="text-xs text-muted-foreground">
          {t('card_meta', { count: props.deck.panelCount, ratio: props.deck.ratio })}
        </p>
      </div>
    </Link>
  );
}
