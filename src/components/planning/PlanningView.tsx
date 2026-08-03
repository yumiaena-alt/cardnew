'use client';

import { Globe, Library, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import type { PlanningFailureCode } from '@/features/planning/actions';
import { pushIdeasToBoard, requestIdeas } from '@/features/planning/actions';
import type { IdeaSource } from '@/features/planning/ideas';
import { cn } from '@/lib/utils';

type PlanningViewProps = {
  boardRowCount: number;
};

/**
 * Where topics can come from. Only self-authored is live; the other two are
 * shown disabled rather than hidden so the shape of the feature is honest
 * about what is coming without pretending it already works.
 */
const SOURCES = [
  { id: 'self', icon: Sparkles, enabled: true },
  { id: 'web', icon: Globe, enabled: false },
  { id: 'library', icon: Library, enabled: false },
] as const satisfies readonly { id: IdeaSource; icon: typeof Sparkles; enabled: boolean }[];

const CONTEXT_FIELD_ID = 'planning-context';
const MIN_CONTEXT_LENGTH = 2;

/**
 * Content planning: decide what a month will say before making any of it.
 *
 * Ideas are transient. They are generated, kept or dropped, and the survivors
 * go straight into the Board — nothing is stored in between, because a separate
 * list of maybes is a list nobody comes back to.
 *
 * @param props - How many rows the current board already holds.
 * @returns The planning screen.
 */
export function PlanningView(props: PlanningViewProps) {
  const t = useTranslations('PlanningPage');
  const [source, setSource] = useState<IdeaSource>('self');
  const [context, setContext] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [failure, setFailure] = useState<PlanningFailureCode | null>(null);
  const [added, setAdded] = useState(0);
  const [isPending, startTransition] = useTransition();

  const generate = () => {
    setFailure(null);
    setAdded(0);

    startTransition(async () => {
      const result = await requestIdeas({ source, context: context.trim() });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setIdeas(result.ideas);
      setKept(new Set(result.ideas));
    });
  };

  const toggle = (idea: string) => {
    const next = new Set(kept);

    if (next.has(idea)) {
      next.delete(idea);
    } else {
      next.add(idea);
    }

    setKept(next);
  };

  const push = () => {
    setFailure(null);

    startTransition(async () => {
      const result = await pushIdeasToBoard({ topics: [...kept] });

      if (!result.ok) {
        setFailure(result.code);

        return;
      }

      setAdded(result.added);
      setIdeas([]);
      setKept(new Set());
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground">{t('source_heading')}</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          {SOURCES.map((entry) => {
            const Icon = entry.icon;
            const isActive = source === entry.id;

            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={isActive}
                disabled={!entry.enabled}
                onClick={() => {
                  setSource(entry.id);
                }}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isActive
                    ? 'border-signal bg-signal/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent',
                  entry.enabled ? '' : 'cursor-not-allowed opacity-50 hover:bg-background',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 place-items-center rounded-full',
                    isActive ? 'bg-signal text-signal-foreground' : 'bg-muted',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {t(`source_${entry.id}`)}
              </button>
            );
          })}
        </div>

        <Field label={t('context_label')} htmlFor={CONTEXT_FIELD_ID} hint={t('context_hint')}>
          <Input
            id={CONTEXT_FIELD_ID}
            value={context}
            maxLength={300}
            placeholder={t('context_placeholder')}
            onChange={(event) => {
              setContext(event.target.value);
            }}
          />
        </Field>

        <Button
          variant="signal"
          size="lg"
          disabled={context.trim().length < MIN_CONTEXT_LENGTH || isPending}
          onClick={generate}
        >
          <Sparkles data-icon="inline-start" />
          {isPending ? t('working') : t('generate')}
        </Button>

        {failure ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {t(`error_${failure}`)}
          </p>
        ) : null}

        {added > 0 ? (
          <p className="rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground">
            {t('pushed', { count: added })}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-status-draft-border bg-status-draft p-4">
          <h3 className="text-sm font-medium text-status-draft-foreground">
            {t('column_ideas', { count: ideas.length })}
          </h3>
          <p className="mt-1 text-xs text-status-draft-foreground/70">{t('column_ideas_hint')}</p>
        </div>

        <div className="rounded-lg border border-status-wait-border bg-status-wait p-4">
          <h3 className="text-sm font-medium text-status-wait-foreground">
            {t('column_kept', { count: kept.size })}
          </h3>
          <p className="mt-1 text-xs text-status-wait-foreground/70">{t('column_kept_hint')}</p>
        </div>

        <div className="rounded-lg border border-status-done-border bg-status-done p-4">
          <h3 className="text-sm font-medium text-status-done-foreground">
            {t('column_board', { count: props.boardRowCount })}
          </h3>
          <p className="mt-1 text-xs text-status-done-foreground/70">{t('column_board_hint')}</p>
        </div>
      </section>

      {ideas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {ideas.map((idea) => (
              <li key={idea}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={kept.has(idea)}
                    className="size-4 accent-signal"
                    onChange={() => {
                      toggle(idea);
                    }}
                  />
                  <span className="text-foreground">{idea}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button size="lg" disabled={kept.size === 0 || isPending} onClick={push}>
              {t('push', { count: kept.size })}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
