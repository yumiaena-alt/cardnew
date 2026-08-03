'use client';

import { PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { CreditBadge } from '@/components/ui/CreditBadge';
import { Field, Textarea } from '@/components/ui/Field';
import type { BlogFailureCode } from '@/features/blog/actions';
import { writeBlogPost } from '@/features/blog/actions';
import { CREDIT_RATES } from '@/features/credit/estimate';
import { useRouter } from '@/libs/I18nNavigation';

type BlogComposerProps = {
  creditBalance: number;
};

const TOPIC_FIELD_ID = 'blog-topic';
const MIN_TOPIC_LENGTH = 2;

/**
 * Drafts a blog post from a topic.
 *
 * The cost is on the button rather than behind a confirmation step. A draft is
 * one charge at a fixed rate with nothing to estimate — a modal asking to
 * approve a number the user can already read would be ceremony, not consent.
 *
 * @param props - The organization's current credit balance.
 * @returns The composer.
 */
export function BlogComposer(props: BlogComposerProps) {
  const t = useTranslations('BlogPage');
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [failure, setFailure] = useState<BlogFailureCode | null>(null);
  const [isPending, startTransition] = useTransition();
  // Held across retries so an impatient second click reuses the key and the
  // ledger recognises it as one draft rather than two.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());

  const cost = CREDIT_RATES.blogPost;
  const canWrite = topic.trim().length >= MIN_TOPIC_LENGTH && !isPending;

  const write = () => {
    setFailure(null);

    startTransition(async () => {
      const result = await writeBlogPost({ topic: topic.trim(), idempotencyKey: attemptKey });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setTopic('');
      setAttemptKey(crypto.randomUUID());
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <Field label={t('topic_label')} htmlFor={TOPIC_FIELD_ID} hint={t('topic_hint')}>
        <Textarea
          id={TOPIC_FIELD_ID}
          value={topic}
          maxLength={500}
          placeholder={t('topic_placeholder')}
          onChange={(event) => {
            setTopic(event.target.value);
          }}
        />
      </Field>

      {failure ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t(`error_${failure}`)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <CreditBadge balance={props.creditBalance} estimate={cost} />

        <Button variant="signal" size="lg" disabled={!canWrite} onClick={write}>
          <PenLine data-icon="inline-start" />
          {isPending ? t('writing') : t('write', { count: cost })}
        </Button>
      </div>
    </div>
  );
}
