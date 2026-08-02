import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PanelGallery } from '@/components/deck/PanelGallery';
import { getDeckView } from '@/features/deck/service';
import { findScope } from '@/features/shared/scope';

type DeckDetailPageProps = {
  params: Promise<{ locale: string; deckId: string }>;
};

export default async function DeckDetailPage(props: DeckDetailPageProps) {
  const { locale, deckId } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DeckDetailPage' });

  const scope = await findScope();
  const view = scope ? await getDeckView(scope, deckId) : null;

  // A deck in another organization is reported the same as one that does not
  // exist, so browsing ids cannot confirm what other tenants own.
  if (!view) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{view.deck.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('meta', {
            count: view.panels.length,
            ratio: view.deck.ratio,
            channel: view.deck.channel,
          })}
        </p>
      </header>

      <PanelGallery panels={view.panels} ratio={view.deck.ratio} />
    </div>
  );
}
