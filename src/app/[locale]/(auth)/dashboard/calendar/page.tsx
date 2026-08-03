import { CalendarDays } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadCalendarMonth } from '@/features/calendar/service';
import { findScope } from '@/features/shared/scope';
import { Link } from '@/libs/I18nNavigation';

type CalendarPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage(props: CalendarPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'CalendarPage' });

  const scope = await findScope();

  if (!scope) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState
          icon={CalendarDays}
          title={t('empty_title')}
          description={t('empty_description')}
        />
      </div>
    );
  }

  const month = await loadCalendarMonth(scope);
  const emptyDays = month.days.filter((day) => day.entries.length === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t('title', { year: month.year, month: month.month })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('summary', { scheduled: month.scheduledCount, empty: emptyDays })}
          </p>
        </div>

        <Button
          variant="signal"
          size="lg"
          render={<Link href="/dashboard/board">{t('fill_action')}</Link>}
        />
      </header>

      {month.unscheduledCount > 0 ? (
        <p className="rounded-lg border border-status-wait-border bg-status-wait p-3 text-sm text-status-wait-foreground">
          {t('unscheduled_note', { count: month.unscheduledCount })}
        </p>
      ) : null}

      <MonthGrid month={month} />
    </div>
  );
}
