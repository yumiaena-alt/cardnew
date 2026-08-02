import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

/**
 * Placeholder for views with no content yet. Always pairs a reason with a next step.
 *
 * @param props - Icon, copy, and an optional call to action.
 * @returns The empty state block.
 */
export function EmptyState(props: EmptyStateProps) {
  const Icon = props.icon;

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold text-foreground">{props.title}</h2>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          {props.description}
        </p>
        {props.action}
      </div>
    </div>
  );
}
