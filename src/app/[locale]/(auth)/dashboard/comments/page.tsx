import { ExternalLink, MessageCircle } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ConnectNotice } from '@/components/dashboard/ConnectNotice';
import { EmptyState } from '@/components/ui/EmptyState';
import { findScope } from '@/features/shared/scope';
import { listUnansweredComments } from '@/features/social/comments';
import { listSocialAccounts } from '@/features/social/repository';

type CommentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CommentsPage(props: CommentsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'CommentsPage' });

  const scope = await findScope();
  const accounts = scope ? await listSocialAccounts(scope) : [];

  // Comments are read live from the network, not mirrored into our database.
  // A local copy would be stale the moment someone replied in the app itself,
  // and there is nothing here we need that the API does not answer directly.
  const inbox =
    accounts.length > 0 && scope
      ? await listUnansweredComments(scope)
      : { comments: [], unreachableAccounts: [] };

  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {accounts.length === 0 ? <ConnectNotice surface="comments" /> : null}

      {inbox.unreachableAccounts.length > 0 ? (
        <p className="rounded-lg border border-status-fail-border bg-status-fail p-3 text-sm text-status-fail-foreground">
          {t('unreachable', { handles: inbox.unreachableAccounts.join(', ') })}
        </p>
      ) : null}

      {inbox.comments.length === 0 ? (
        // 미연동일 때 할 말은 위 배너가 이미 한다. 한 화면에서 같은 말을 두 번
        // 하면 어느 쪽을 눌러야 하는지가 흐려진다.
        <EmptyState
          icon={MessageCircle}
          title={t('empty_title')}
          description={t('empty_description')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {inbox.comments.map((comment) => (
            <li
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              key={comment.id}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {comment.username === '' ? t('unknown_author') : `@${comment.username}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>{comment.accountHandle}</span>
                {comment.createdAt ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <time dateTime={comment.createdAt}>
                      {formatter.format(new Date(comment.createdAt))}
                    </time>
                  </>
                ) : null}
              </div>

              <p className="text-sm text-foreground">{comment.text}</p>

              {comment.permalink ? (
                <a
                  className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  href={comment.permalink}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {t('open_post')}
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
