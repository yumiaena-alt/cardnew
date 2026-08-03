import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UpgradeButton } from '@/components/dashboard/UpgradeButton';
import { findPlanLimit } from '@/features/billing/repository';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type PlanPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PlanPage(props: PlanPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'PlanPage' });

  const scope = await findScope();
  const [balance, plan] = await Promise.all([
    scope ? getBalance(scope) : Promise.resolve(0),
    findPlanLimit(scope?.planKey ?? 'free'),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {t('current_plan', { plan: scope?.planKey ?? 'free' })}
          </span>
          <span className="tabular text-sm text-muted-foreground">
            {t('balance', { count: balance })}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('allowance', { count: plan?.monthlyCredits ?? 0 })}
        </p>

        <UpgradeButton />
      </div>
    </div>
  );
}
