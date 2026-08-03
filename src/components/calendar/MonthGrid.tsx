import { useTranslations } from 'next-intl';
import type { CalendarDay, CalendarMonth } from '@/features/calendar/service';
import { cn } from '@/lib/utils';

type MonthGridProps = {
  month: CalendarMonth;
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * One day cell.
 *
 * An empty day is styled as an invitation rather than as an error. Nothing is
 * wrong with a blank Tuesday — it is just work that has not been decided yet,
 * and colouring it red would make a normal month look like a problem.
 *
 * @param props - The day and its entries.
 * @returns The day cell.
 */
function DayCell(props: { day: CalendarDay }) {
  const t = useTranslations('CalendarPage');
  const isEmpty = props.day.entries.length === 0;

  return (
    <div
      className={cn(
        'flex min-h-24 flex-col gap-1 rounded-md border p-2',
        isEmpty ? 'border-dashed border-border bg-background' : 'border-border bg-card',
      )}
    >
      <span className="tabular text-xs font-medium text-muted-foreground">
        {props.day.dayOfMonth}
      </span>

      {isEmpty ? (
        <span className="text-xs text-muted-foreground/60">{t('day_empty')}</span>
      ) : (
        <ul className="flex flex-col gap-1">
          {props.day.entries.map((entry) => (
            <li
              key={`${props.day.date}-${entry.topic}`}
              className="rounded-sm bg-signal/15 px-1.5 py-1 text-xs leading-snug text-foreground"
            >
              <span className="line-clamp-2">{entry.topic}</span>
            </li>
          ))}
        </ul>
      )}

      {props.day.bookings.length > 0 ? (
        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-status-done-border bg-status-done px-1.5 py-0.5 text-[0.6875rem] font-medium text-status-done-foreground">
          {t('day_booked', { count: props.day.bookings.length })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The publishing month.
 *
 * @param props - The month to render.
 * @returns The calendar grid.
 */
export function MonthGrid(props: MonthGridProps) {
  const t = useTranslations('CalendarPage');

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key} className="px-1 text-xs font-medium text-muted-foreground">
            {t(`weekday_${key}`)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: props.month.leadingBlanks }, (_, index) => (
          <div key={`blank-${index + 1}`} aria-hidden="true" />
        ))}

        {props.month.days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}
