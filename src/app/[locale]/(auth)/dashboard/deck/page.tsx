import { Images } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Link } from '@/libs/I18nNavigation';

type DeckListPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeckListPage(props: DeckListPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DeckListPage' });

  return (
    <div className="mx-auto max-w-6xl">
      <EmptyState
        icon={Images}
        title={t('empty_title')}
        description={t('empty_description')}
        action={
          <Button
            render={<Link href="/dashboard/deck/new">{t('create_action')}</Link>}
            size="lg"
            variant="signal"
          />
        }
      />
    </div>
  );
}
