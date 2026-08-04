import { ChevronRight, Palette } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeckCreateForm } from '@/components/deck/DeckCreateForm';
import { DeckTabs } from '@/components/deck/DeckTabs';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';
import { Link } from '@/libs/I18nNavigation';

type DeckNewPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeckNewPage(props: DeckNewPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DeckNewPage' });

  const scope = await findScope();
  const creditBalance = scope ? await getBalance(scope) : 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <DeckTabs />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <DeckCreateForm creditBalance={creditBalance} />

      {/* The gallery sits here rather than in the menu: picking a look is a way
          of starting a card news, not somewhere you go on its own. */}
      <Link
        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        href="/dashboard/templates"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
            <Palette className="size-4" aria-hidden="true" />
          </span>

          <span className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{t('templates_title')}</span>
            <span className="text-sm text-muted-foreground">{t('templates_description')}</span>
          </span>
        </span>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </div>
  );
}
