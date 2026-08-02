import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Status pill for decks, board rows, and runs.
 *
 * The four tones are the ones the design system defines, so a status added
 * later has to be mapped onto waiting, working, done, or failed rather than
 * inventing a fifth colour that means nothing to anyone.
 */
const statusChipVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium',
  {
    variants: {
      tone: {
        wait: 'border-status-wait-border bg-status-wait text-status-wait-foreground',
        draft: 'border-status-draft-border bg-status-draft text-status-draft-foreground',
        done: 'border-status-done-border bg-status-done text-status-done-foreground',
        fail: 'border-status-fail-border bg-status-fail text-status-fail-foreground',
      },
    },
    defaultVariants: {
      tone: 'draft',
    },
  },
);

type StatusChipProps = React.ComponentProps<'span'> & VariantProps<typeof statusChipVariants>;

/**
 * Renders a status pill.
 *
 * @param props - Standard span props plus the status `tone`.
 * @returns The status chip.
 */
export function StatusChip(props: StatusChipProps) {
  const { className, tone, ...rest } = props;

  return (
    <span
      data-slot="status-chip"
      className={cn(statusChipVariants({ tone, className }))}
      {...rest}
    />
  );
}
