import { Palette } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@/components/ui/EmptyState';

type TemplateGalleryPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TemplateGalleryPage(props: TemplateGalleryPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'TemplateGalleryPage' });

  return (
    <div className="mx-auto max-w-6xl">
      <EmptyState
        icon={Palette}
        title={t('scaffold_title')}
        description={t('scaffold_description')}
      />
    </div>
  );
}
