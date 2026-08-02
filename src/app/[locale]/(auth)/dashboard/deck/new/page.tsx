import { Sparkles } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@/components/ui/EmptyState';

type DeckNewPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeckNewPage(props: DeckNewPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DeckNewPage' });

  return (
    <div className="mx-auto max-w-6xl">
      <EmptyState
        icon={Sparkles}
        title={t('scaffold_title')}
        description={t('scaffold_description')}
      />
    </div>
  );
}
