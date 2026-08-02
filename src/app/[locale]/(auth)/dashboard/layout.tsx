import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Shown while a freshly signed-up organization waits for its Clerk webhook. */
const UNRESOLVED_PLAN_KEY = 'free';

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

  // Reads the ledger rather than a cached column, so the badge can never drift
  // from the entries that produced it.
  const scope = await findScope();
  const creditBalance = scope ? await getBalance(scope) : 0;

  return (
    <DashboardShell
      creditBalance={creditBalance}
      planKey={scope?.planKey ?? UNRESOLVED_PLAN_KEY}
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
