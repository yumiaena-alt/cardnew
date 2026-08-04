import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeckCreateForm } from '@/components/deck/DeckCreateForm';
import { DeckTabs } from '@/components/deck/DeckTabs';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

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
    </div>
  );
}
