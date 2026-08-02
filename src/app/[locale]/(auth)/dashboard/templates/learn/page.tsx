import { ImagePlus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@/components/ui/EmptyState';

type TemplateLearnPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TemplateLearnPage(props: TemplateLearnPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'TemplateLearnPage' });

  return (
    <div className="mx-auto max-w-6xl">
      <EmptyState
        icon={ImagePlus}
        title={t('scaffold_title')}
        description={t('scaffold_description')}
      />
    </div>
  );
}
