import { setRequestLocale } from 'next-intl/server';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';

export default async function MarketingLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="flex-1">{props.children}</main>
      <MarketingFooter />
    </div>
  );
}
