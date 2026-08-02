'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import {
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalRoot,
  ModalTitle,
} from '@/components/ui/Modal';
import type { RunFailureCode } from '@/features/run/actions';
import type { RunEstimate } from '@/features/run/estimate';
import { Link } from '@/libs/I18nNavigation';

type DryRunPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quote from the server. Null while it is still being fetched. */
  estimate: RunEstimate | null;
  balance: number;
  failureCode: RunFailureCode | null;
  isPending: boolean;
  /** Set once generation has been accepted. Switches the modal to its done state. */
  startedRunId: string | null;
  onConfirm: () => void;
};

/**
 * The quote shown before any credit moves.
 *
 * The estimate comes from the server rather than the sheet's own running total:
 * the number the user approves here has to be the number the charge uses, and
 * only the server can promise that.
 *
 * @param props - Quote, balance, pending and failure state, and the confirm handler.
 * @returns The dry-run modal.
 */
export function DryRunPanel(props: DryRunPanelProps) {
  const t = useTranslations('DryRunPanel');

  const total = props.estimate?.total ?? 0;
  const isShort = total > props.balance;
  const canRun = props.estimate !== null && !isShort && !props.isPending;
  const hasStarted = props.startedRunId !== null;

  return (
    <ModalRoot open={props.open} onOpenChange={props.onOpenChange}>
      <ModalContent aria-busy={props.isPending}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-signal-foreground" aria-hidden="true" />
          <ModalTitle>{t('title')}</ModalTitle>
        </div>

        <ModalDescription>
          {hasStarted ? t('started_description') : t('description')}
        </ModalDescription>

        {props.estimate && !hasStarted ? (
          <dl className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('origin_count')}</dt>
              <dd className="tabular font-medium">{props.estimate.originCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('cut_count')}</dt>
              <dd className="tabular font-medium">{props.estimate.cutCount}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <dt className="font-medium">{t('total')}</dt>
              <dd className="tabular font-semibold">{t('credits', { count: total })}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('balance_after')}</dt>
              <dd className="tabular text-muted-foreground">
                {t('credits', { count: props.balance - total })}
              </dd>
            </div>
          </dl>
        ) : null}

        {hasStarted ? (
          <p className="rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground">
            {t('started_note')}
          </p>
        ) : null}

        {isShort && !hasStarted ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {t('short_balance', { missing: total - props.balance })}
          </p>
        ) : null}

        {props.failureCode ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {t(`error_${props.failureCode}`)}
          </p>
        ) : null}

        <ModalFooter>
          {hasStarted ? (
            <>
              <ModalClose
                render={
                  <Button variant="ghost" size="lg">
                    {t('close')}
                  </Button>
                }
              />
              <Button
                variant="default"
                size="lg"
                render={<Link href="/dashboard/deck">{t('view_decks')}</Link>}
              />
            </>
          ) : (
            <>
              <ModalClose
                render={
                  <Button variant="ghost" size="lg">
                    {t('cancel')}
                  </Button>
                }
              />
              <Button variant="signal" size="lg" disabled={!canRun} onClick={props.onConfirm}>
                {props.isPending ? t('running') : t('confirm')}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  );
}
