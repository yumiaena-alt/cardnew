import { setRequestLocale } from 'next-intl/server';
import { ReferenceSearchView } from '@/components/reference/ReferenceSearchView';
import { isReferenceSearchConfigured } from '@/features/reference/provider';

type ReferencePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ReferencePage(props: ReferencePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <ReferenceSearchView isAvailable={isReferenceSearchConfigured()} />;
}
