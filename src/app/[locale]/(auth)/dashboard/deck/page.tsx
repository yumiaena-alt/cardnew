import { Images } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeckCard } from '@/components/deck/DeckCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { listDecks } from '@/features/deck/repository';
import { findScope } from '@/features/shared/scope';
import { Link } from '@/libs/I18nNavigation';

type DeckListPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeckListPage(props: DeckListPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DeckListPage' });

  // A session whose organization has not replicated yet sees the empty state
  // rather than an error: the shell has to render either way.
  const scope = await findScope();
  const decks = scope ? await listDecks(scope) : [];

  if (decks.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState
          icon={Images}
          title={t('empty_title')}
          description={t('empty_description')}
          action={
            <Button
              render={<Link href="/dashboard/board">{t('create_action')}</Link>}
              size="lg"
              variant="signal"
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('summary', { count: decks.length })}
          </p>
        </div>

        <Button
          render={<Link href="/dashboard/board">{t('create_action')}</Link>}
          size="lg"
          variant="signal"
        />
      </header>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {decks.map((deck) => (
          <li key={deck.id}>
            <DeckCard deck={deck} />
          </li>
        ))}
      </ul>
    </div>
  );
}
