'use client';

import { CalendarClock, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { createSchedule, removeSchedule } from '@/features/publish/actions';
import type { AccountSummary } from '@/features/social/repository';
import type { Schedule } from '@/models/Publish';

type SchedulePanelProps = {
  deckId: string;
  accounts: AccountSummary[];
  schedules: Schedule[];
};

const WHEN_FIELD_ID = 'schedule-when';
const CAPTION_FIELD_ID = 'schedule-caption';

/** Tone per lifecycle state, so a failed post does not read as a done one. */
const STATUS_TONE = {
  pending: 'wait',
  publishing: 'wait',
  published: 'done',
  failed: 'fail',
  canceled: 'draft',
} as const;

/**
 * Booking this deck to go out.
 *
 * A booking is only cancellable while it is still pending. Once the worker has
 * taken it there is nothing to call off — the post is already being created on
 * the network, and offering a cancel button would promise a recall we cannot
 * perform.
 *
 * @param props - The deck, the connected accounts, and existing bookings.
 * @returns The scheduling panel.
 */
export function SchedulePanel(props: SchedulePanelProps) {
  const t = useTranslations('SchedulePanel');
  const format = useFormatter();
  const [isOpen, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(props.accounts[0]?.id ?? '');
  const [when, setWhen] = useState('');
  const [caption, setCaption] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = accountId !== '' && when !== '' && !isPending;

  // Written out rather than looked up by key: `t` is typed against the message
  // catalogue, and a computed key would defeat both that and the unused-key check.
  const statusLabel = {
    pending: t('status_pending'),
    publishing: t('status_publishing'),
    published: t('status_published'),
    failed: t('status_failed'),
    canceled: t('status_canceled'),
  };

  const submit = () => {
    setFailure(null);

    startTransition(async () => {
      const result = await createSchedule({
        deckId: props.deckId,
        socialAccountId: accountId,
        // A datetime-local value carries no zone, so it is read in the
        // browser's — which is the one the person picking it is thinking in.
        scheduledAt: new Date(when),
        caption: caption.trim() === '' ? null : caption.trim(),
        hashtags: [],
      });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setWhen('');
      setCaption('');
      setOpen(false);
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {props.accounts.length > 0 ? (
          <Button
            onClick={() => {
              setOpen((open) => !open);
            }}
            size="lg"
            variant="secondary"
          >
            <CalendarClock data-icon="inline-start" />
            {t('new_action')}
          </Button>
        ) : null}
      </header>

      {props.accounts.length === 0 ? (
        <p className="rounded-lg border border-status-wait-border bg-status-wait p-3 text-sm text-status-wait-foreground">
          {t('no_account')}
        </p>
      ) : null}

      {isOpen ? (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-background p-4">
          <Field label={t('account_label')}>
            <Select
              aria-label={t('account_label')}
              onValueChange={setAccountId}
              options={props.accounts.map((account) => ({
                value: account.id,
                label: account.handle,
              }))}
              value={accountId}
            />
          </Field>

          <Field htmlFor={WHEN_FIELD_ID} label={t('when_label')}>
            <Input
              id={WHEN_FIELD_ID}
              onChange={(event) => {
                setWhen(event.target.value);
              }}
              type="datetime-local"
              value={when}
            />
          </Field>

          <Field htmlFor={CAPTION_FIELD_ID} label={t('caption_label')}>
            <Textarea
              id={CAPTION_FIELD_ID}
              maxLength={2200}
              onChange={(event) => {
                setCaption(event.target.value);
              }}
              placeholder={t('caption_placeholder')}
              rows={4}
              value={caption}
            />
          </Field>

          {failure ? (
            <p className="rounded-md border border-status-fail-border bg-status-fail p-2.5 text-sm text-status-fail-foreground">
              {failure === 'conflict' ? t('error_conflict') : t('error_failed')}
            </p>
          ) : null}

          <Button disabled={!canSubmit} onClick={submit} size="lg">
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </div>
      ) : null}

      {props.schedules.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {props.schedules.map((schedule) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              key={schedule.id}
            >
              <span className="tabular text-sm text-foreground">
                {format.dateTime(schedule.scheduledAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>

              <span className="flex items-center gap-2">
                <StatusChip tone={STATUS_TONE[schedule.status]}>
                  {statusLabel[schedule.status]}
                </StatusChip>

                {schedule.status === 'pending' ? (
                  <Button
                    aria-label={t('cancel')}
                    onClick={() => {
                      startTransition(async () => {
                        await removeSchedule({ scheduleId: schedule.id });
                      });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <X data-icon="inline-start" />
                    {t('cancel')}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
