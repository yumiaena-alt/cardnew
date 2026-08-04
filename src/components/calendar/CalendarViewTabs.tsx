import { CalendarDays, LayoutGrid } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

export type CalendarView = 'calendar' | 'board';

type CalendarViewTabsProps = {
  active: CalendarView;
};

const VIEWS = [
  { id: 'calendar', icon: CalendarDays, href: '/dashboard/calendar' },
  { id: 'board', icon: LayoutGrid, href: '/dashboard/calendar?view=board' },
] as const satisfies readonly { id: CalendarView; icon: typeof CalendarDays; href: string }[];

/**
 * Switches a month between the two ways of looking at it.
 *
 * The grid answers "what goes out and when" and the sheet answers "what am I
 * making this month". They were two menu entries, which put the gap the
 * calendar reveals and the tool that fills it on opposite sides of the sidebar.
 *
 * @param props - Which view is showing.
 * @returns The view switch.
 */
export async function CalendarViewTabs(props: CalendarViewTabsProps) {
  const t = await getTranslations('CalendarPage');
  const labels: Record<CalendarView, string> = {
    calendar: t('view_calendar'),
    board: t('view_board'),
  };

  return (
    <nav
      aria-label={t('view_label')}
      className="flex w-fit gap-1 rounded-xl border border-border bg-card p-1"
    >
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = props.active === view.id;

        return (
          <Link
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            href={view.href}
            key={view.id}
          >
            <Icon className="size-4" aria-hidden="true" />
            {labels[view.id]}
          </Link>
        );
      })}
    </nav>
  );
}
