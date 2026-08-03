import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BlogComposer } from '@/components/blog/BlogComposer';
import { StatusChip } from '@/components/ui/StatusChip';
import { listBlogPosts } from '@/features/blog/repository';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';

type BlogPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function BlogPage(props: BlogPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'BlogPage' });

  const scope = await findScope();
  const [posts, creditBalance] = await Promise.all([
    scope ? listBlogPosts(scope) : Promise.resolve([]),
    scope ? getBalance(scope) : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <BlogComposer creditBalance={creditBalance} />

      {posts.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">
            {t('drafts_heading', { count: posts.length })}
          </h2>

          <ul className="flex flex-col gap-3">
            {posts.map((post) => (
              <li key={post.id}>
                <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{post.title}</h3>
                    <StatusChip tone="done">{t('status_ready')}</StatusChip>
                  </div>

                  <p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                    {post.body}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {t('draft_meta', { count: post.body.length, credits: post.creditsCharged })}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
