import { Diamond } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Below this ratio of the plan allowance, the badge warns instead of informing. */
const LOW_BALANCE_RATIO = 0.2;

type CreditBadgeProps = {
  balance: number;
  /** Monthly allowance, used to decide when the balance reads as low. */
  allowance?: number;
  /** Estimated cost of a pending run. Renders the badge in estimate mode. */
  estimate?: number;
};

/**
 * Shows the credit balance, or a pending run estimate when `estimate` is set.
 * Numbers use tabular figures so the badge never jitters as values change.
 *
 * @param props - Balance, optional allowance for the low-balance threshold, and optional estimate.
 * @returns The credit badge.
 */
export function CreditBadge(props: CreditBadgeProps) {
  const t = useTranslations('Credit');
  const isEstimate = props.estimate !== undefined;
  const isLow =
    !isEstimate &&
    props.allowance !== undefined &&
    props.balance < props.allowance * LOW_BALANCE_RATIO;

  const value = isEstimate ? props.estimate : props.balance;

  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        isEstimate && 'border-transparent bg-secondary text-secondary-foreground',
        !isEstimate && isLow && 'border-warning/30 bg-warning/10 text-warning',
        !isEstimate && !isLow && 'border-border bg-card text-muted-foreground',
      )}
      title={isEstimate ? t('estimate_label') : t('balance_label')}
    >
      <Diamond className="size-3" aria-hidden="true" />
      <span className="tabular">{value}</span>
      <span>{t('unit')}</span>
    </span>
  );
}
