'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

type ErrorPanelProps = {
  /** Next's error digest, when it has one. Ties the panel to a server log entry. */
  digest?: string;
  /** The boundary's re-render callback. */
  onRetry: () => void;
};

/**
 * What a caught dashboard failure looks like.
 *
 * Shared by both dashboard boundaries so the same failure reads the same way
 * whether it came from a page or from the shell's own data fetch.
 *
 * @param props - The error digest and the boundary's retry callback.
 * @returns The error panel.
 */
export function ErrorPanel(props: ErrorPanelProps) {
  const t = useTranslations('DashboardError');

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6">
      <span className="grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-base font-semibold text-foreground">{t('heading')}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('body')}</p>
      </div>

      {props.digest && (
        <div className="flex w-full flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{t('digest_label')}</span>
          <code className="rounded-sm bg-muted px-2 py-1.5 font-mono text-xs break-all text-muted-foreground">
            {props.digest}
          </code>
        </div>
      )}

      <Button size="lg" onClick={props.onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}
