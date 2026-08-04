import { History } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeckTabs } from '@/components/deck/DeckTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { listRuns } from '@/features/run/repository';
import { findScope } from '@/features/shared/scope';
import type { RunStatus } from '@/models/Run';

type RunHistoryPageProps = {
  params: Promise<{ locale: string }>;
};

/** How a run's status reads as a chip. Failure and refund are worth seeing. */
const STATUS_TONE: Record<RunStatus, 'wait' | 'draft' | 'done' | 'fail'> = {
  estimated: 'draft',
  queued: 'wait',
  running: 'wait',
  done: 'done',
  failed: 'fail',
  canceled: 'draft',
};

export default async function RunHistoryPage(props: RunHistoryPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations('RunHistoryPage');
  const scope = await findScope();
  const runs = scope ? await listRuns(scope) : [];

  const formatDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <DeckTabs />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {runs.length === 0 ? (
        <EmptyState description={t('empty_description')} icon={History} title={t('empty_title')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              key={run.id}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  {t(`scope_${run.scopeKind}`)} · {t('cuts', { count: run.itemCount })}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDate.format(run.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground tabular-nums">
                  {t('charged', { count: run.chargedCredits - run.refundedCredits })}
                </span>

                {/* Shown only when something came back, because a refund means a
                    cut was not delivered and that is worth noticing. */}
                {run.refundedCredits > 0 ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t('refunded', { count: run.refundedCredits })}
                  </span>
                ) : null}

                <StatusChip tone={STATUS_TONE[run.status]}>{t(`status_${run.status}`)}</StatusChip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
