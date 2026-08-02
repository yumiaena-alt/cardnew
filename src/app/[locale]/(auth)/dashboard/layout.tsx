import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Free-tier allowance until the billing tables land in Phase 1-C. */
const PLACEHOLDER_CREDIT_BALANCE = 50;
const PLACEHOLDER_PLAN_KEY = 'free';

export async function generateMetadata(props: DashboardLayoutProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'DashboardLayout' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <DashboardShell
      creditBalance={PLACEHOLDER_CREDIT_BALANCE}
      planKey={PLACEHOLDER_PLAN_KEY}
      topbarActions={
        <>
          <LocaleSwitcher />
          <UserButton />
        </>
      }
    >
      {props.children}
    </DashboardShell>
  );
}
