import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LinkImportForm } from '@/components/deck/LinkImportForm';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type DeckLinkPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeckLinkPage(props: DeckLinkPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DeckLinkPage' });

  const scope = await findScope();
  const creditBalance = scope ? await getBalance(scope) : 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <LinkImportForm creditBalance={creditBalance} />
    </div>
  );
}
