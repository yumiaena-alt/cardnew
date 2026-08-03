import { MessageCircle } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@/components/ui/EmptyState';
import { findScope } from '@/features/shared/scope';
import { listSocialAccounts } from '@/features/social/repository';

type CommentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CommentsPage(props: CommentsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'CommentsPage' });

  const scope = await findScope();
  const accounts = scope ? await listSocialAccounts(scope) : [];

  // Comments are read live from the network, not mirrored into our database.
  // A local copy would be stale the moment someone replied in the app itself,
  // and there is nothing here we need that the API does not answer directly.
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <EmptyState
        icon={MessageCircle}
        title={accounts.length === 0 ? t('unconnected_title') : t('empty_title')}
        description={accounts.length === 0 ? t('unconnected_description') : t('empty_description')}
      />
    </div>
  );
}
