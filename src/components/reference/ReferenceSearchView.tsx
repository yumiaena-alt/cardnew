'use client';

import { ExternalLink, Megaphone, Search, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { CREDIT_RATES } from '@/features/credit/estimate';
import type { ReferenceFailureCode } from '@/features/reference/actions';
import { runReferenceSearch } from '@/features/reference/actions';
import type { Reference } from '@/features/reference/provider';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

type ReferenceSearchViewProps = {
  /** False when no ad library token is configured. Search is refused server-side too. */
  isAvailable: boolean;
};

const KINDS = [
  { id: 'ad', icon: Megaphone },
  { id: 'viral', icon: TrendingUp },
] as const;

const WINDOWS = [7, 30, 90] as const;

type Kind = (typeof KINDS)[number]['id'];
type Window = (typeof WINDOWS)[number];

const MIN_QUERY_LENGTH = 2;

/**
 * Reference research: find published ads worth borrowing structure from.
 *
 * Results link out to the original rather than re-hosting it. What is useful
 * here is how a message is put together, and copying the asset itself would be
 * taking someone's work rather than learning from it.
 *
 * @param props - Whether the search backend is configured.
 * @returns The reference search screen.
 */
export function ReferenceSearchView(props: ReferenceSearchViewProps) {
  const t = useTranslations('ReferencePage');
  const [kind, setKind] = useState<Kind>('ad');
  const [windowDays, setWindowDays] = useState<Window>(30);
  const [query, setQuery] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [selected, setSelected] = useState<Reference | null>(null);
  const [failure, setFailure] = useState<ReferenceFailureCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSearch = props.isAvailable && query.trim().length >= MIN_QUERY_LENGTH && !isPending;

  const search = () => {
    setFailure(null);

    startTransition(async () => {
      const result = await runReferenceSearch({ query: query.trim(), kind, windowDays });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setReferences(result.references);
      setSelected(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            {t('eyebrow')}
          </span>
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Button
          variant="outline"
          size="lg"
          render={<Link href="/dashboard/planning">{t('back_to_planning')}</Link>}
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
              {KINDS.map((entry) => {
                const Icon = entry.icon;
                const isActive = kind === entry.id;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setKind(entry.id);
                    }}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                      isActive
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {t(`kind_${entry.id}`)}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                maxLength={120}
                placeholder={t('query_placeholder')}
                aria-label={t('query_label')}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />

              <Button variant="signal" size="lg" disabled={!canSearch} onClick={search}>
                <Search data-icon="inline-start" />
                {isPending
                  ? t('searching')
                  : t('search_with_cost', { count: CREDIT_RATES.referenceSearch })}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {WINDOWS.map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={windowDays === days}
                  onClick={() => {
                    setWindowDays(days);
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                    windowDays === days
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t('window_days', { count: days })}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {t('cost_note', { count: CREDIT_RATES.referenceSearch })}
            </p>

            {props.isAvailable ? null : (
              <p className="rounded-lg border border-status-wait-border bg-status-wait p-3 text-sm text-status-wait-foreground">
                {t('unavailable_note')}
              </p>
            )}

            {failure ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {t(`error_${failure}`)}
              </p>
            ) : null}
          </section>

          <section className="min-h-80 rounded-lg border border-border bg-card p-4">
            {references.length === 0 ? (
              <div className="grid min-h-72 place-items-center">
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Megaphone className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium text-foreground">{t('empty_title')}</p>
                  <p className="text-sm text-muted-foreground">{t('empty_description')}</p>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {references.map((reference) => (
                  <li key={reference.id}>
                    <button
                      type="button"
                      aria-pressed={selected?.id === reference.id}
                      onClick={() => {
                        setSelected(reference);
                      }}
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        selected?.id === reference.id
                          ? 'border-signal bg-signal/10'
                          : 'border-border bg-background hover:bg-accent',
                      )}
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {reference.pageName}
                      </span>
                      <span className="line-clamp-3 text-sm text-foreground">{reference.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-h-80 flex-col rounded-lg border border-border bg-card p-4">
          {selected ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-foreground">{selected.pageName}</h2>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{selected.body}</p>

              {selected.platforms.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('platforms', { list: selected.platforms.join(', ') })}
                </p>
              ) : null}

              {selected.snapshotUrl === '' ? null : (
                <a
                  href={selected.snapshotUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
                >
                  {t('open_original')}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center text-center">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-foreground">{t('select_title')}</p>
                <p className="text-sm text-muted-foreground">{t('select_description')}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
