import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeckTabs } from '@/components/deck/DeckTabs';
import { DesignLearnForm } from '@/components/template/DesignLearnForm';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type DesignLearnPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DesignLearnPage(props: DesignLearnPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'DesignLearnPage' });
  const scope = await findScope();
  const creditBalance = scope ? await getBalance(scope) : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <DeckTabs />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <DesignLearnForm creditBalance={creditBalance} />
    </div>
  );
}
