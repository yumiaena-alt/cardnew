'use client';

import { Plus, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { createAutomation, removeAutomation, toggleAutomation } from '@/features/social/actions';
import type { AccountSummary } from '@/features/social/repository';
import type { DmAutomation } from '@/models/Social';

type AutomationViewProps = {
  accounts: AccountSummary[];
  automations: DmAutomation[];
};

/** The three-step explainer, as literal keys so `t()` stays type-checked. */
const STEP_KEYS = ['step_1', 'step_2', 'step_3'] as const;

const NAME_FIELD_ID = 'automation-name';
const KEYWORDS_FIELD_ID = 'automation-keywords';
const MESSAGE_FIELD_ID = 'automation-message';

/**
 * Keyword-triggered replies to comments.
 *
 * The three steps on screen are the whole model: watch a post, match a word,
 * send one reply. There is nowhere to type a recipient, because this answers
 * people who commented rather than reaching out to anyone.
 *
 * @param props - Connected accounts and existing automations.
 * @returns The automation screen.
 */
export function AutomationView(props: AutomationViewProps) {
  const t = useTranslations('AutomationPage');
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [account] = props.accounts;
  const canCreate =
    account !== undefined &&
    name.trim() !== '' &&
    keywords.trim() !== '' &&
    message.trim() !== '' &&
    !isPending;

  const submit = () => {
    if (!account) {
      return;
    }

    setFailure(null);

    startTransition(async () => {
      const result = await createAutomation({
        accountId: account.id,
        name: name.trim(),
        keywords: keywords
          .split(',')
          .map((word) => word.trim())
          .filter((word) => word !== ''),
        message: message.trim(),
      });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setName('');
      setKeywords('');
      setMessage('');
      setOpen(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {props.accounts.length > 0 ? (
          <Button
            variant="signal"
            size="lg"
            onClick={() => {
              setOpen((open) => !open);
            }}
          >
            <Plus data-icon="inline-start" />
            {t('new_action')}
          </Button>
        ) : null}
      </header>

      {props.accounts.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <span className="grid size-14 place-items-center rounded-xl bg-signal/15 text-signal-foreground">
            <Zap className="size-6" aria-hidden="true" />
          </span>

          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">{t('empty_title')}</h2>
            <p className="text-sm text-muted-foreground">{t('empty_description')}</p>
          </div>

          <ol className="flex flex-wrap justify-center gap-6">
            {STEP_KEYS.map((key, index) => (
              <li key={key} className="flex flex-col items-center gap-1.5">
                <span className="tabular grid size-8 place-items-center rounded-full bg-muted text-xs font-medium text-foreground">
                  {index + 1}
                </span>
                <span className="text-xs text-muted-foreground">{t(key)}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted-foreground">{t('connect_note')}</p>
        </section>
      ) : null}

      {isOpen ? (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <Field label={t('name_label')} htmlFor={NAME_FIELD_ID}>
            <Input
              id={NAME_FIELD_ID}
              value={name}
              maxLength={80}
              placeholder={t('name_placeholder')}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </Field>

          <Field label={t('keywords_label')} htmlFor={KEYWORDS_FIELD_ID} hint={t('keywords_hint')}>
            <Input
              id={KEYWORDS_FIELD_ID}
              value={keywords}
              maxLength={200}
              placeholder={t('keywords_placeholder')}
              onChange={(event) => {
                setKeywords(event.target.value);
              }}
            />
          </Field>

          <Field label={t('message_label')} htmlFor={MESSAGE_FIELD_ID} hint={t('message_hint')}>
            <Textarea
              id={MESSAGE_FIELD_ID}
              value={message}
              maxLength={900}
              placeholder={t('message_placeholder')}
              onChange={(event) => {
                setMessage(event.target.value);
              }}
            />
          </Field>

          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {t('create_failed')}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button size="lg" disabled={!canCreate} onClick={submit}>
              {isPending ? t('saving') : t('save')}
            </Button>
          </div>
        </section>
      ) : null}

      {props.automations.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {props.automations.map((automation) => (
            <li key={automation.id}>
              <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{automation.name}</h3>
                    <StatusChip tone={automation.isActive ? 'done' : 'draft'}>
                      {automation.isActive ? t('status_on') : t('status_off')}
                    </StatusChip>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t('keywords_summary', { list: automation.keywords.join(', ') })}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await toggleAutomation({
                          automationId: automation.id,
                          isActive: !automation.isActive,
                        });
                      });
                    }}
                  >
                    {automation.isActive ? t('turn_off') : t('turn_on')}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await removeAutomation(automation.id);
                      });
                    }}
                  >
                    {t('remove')}
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
