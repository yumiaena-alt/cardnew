import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChannelMix } from '@/components/analytics/ChannelMix';
import { StatTile } from '@/components/analytics/StatTile';
import { ConnectNotice } from '@/components/dashboard/ConnectNotice';
import { loadProductionStats } from '@/features/analytics/repository';
import { toChannelShares } from '@/features/analytics/share';
import { findScope } from '@/features/shared/scope';
import { listSocialAccounts } from '@/features/social/repository';

type AnalyticsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AnalyticsPage(props: AnalyticsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AnalyticsPage' });

  const scope = await findScope();
  const accounts = scope ? await listSocialAccounts(scope) : [];
  const stats = scope
    ? await loadProductionStats(scope)
    : {
        deckTotal: 0,
        deckThisMonth: 0,
        blogTotal: 0,
        creditsSpentThisMonth: 0,
        runsDone: 0,
        runsFailed: 0,
        byChannel: [],
      };

  const runTotal = stats.runsDone + stats.runsFailed;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {accounts.length === 0 ? <ConnectNotice surface="analytics" /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t('stat_month')}
          value={String(stats.deckThisMonth)}
          hint={t('stat_month_hint', { count: stats.deckTotal })}
        />
        <StatTile label={t('stat_blog')} value={String(stats.blogTotal)} />
        <StatTile
          label={t('stat_credits')}
          value={String(stats.creditsSpentThisMonth)}
          hint={t('stat_credits_hint')}
        />
        <StatTile
          label={t('stat_runs')}
          value={runTotal === 0 ? '—' : `${stats.runsDone}/${runTotal}`}
          hint={stats.runsFailed > 0 ? t('stat_runs_hint', { count: stats.runsFailed }) : undefined}
        />
      </div>

      <ChannelMix shares={toChannelShares(stats.byChannel)} />

      <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        {t('reach_note')}
      </p>
    </div>
  );
}
