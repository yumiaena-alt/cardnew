import { Link2, Plug } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { findScope } from '@/features/shared/scope';
import { buildAuthorizeUrl, isConnectConfigured } from '@/features/social/connect';
import { listSocialAccounts } from '@/features/social/repository';
import { Env } from '@/libs/Env';

type AccountsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AccountsPage(props: AccountsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AccountsPage' });

  const scope = await findScope();
  const accounts = scope ? await listSocialAccounts(scope) : [];

  const redirectUri = `${Env.NEXT_PUBLIC_APP_URL ?? ''}/api/oauth/instagram/callback`;
  const authorizeUrl = scope ? buildAuthorizeUrl(scope, redirectUri) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Plug className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">{t('empty_title')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('empty_description')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{account.handle}</span>
                  <span className="text-xs text-muted-foreground">{account.channel}</span>
                </div>

                <StatusChip tone={account.isActive ? 'done' : 'draft'}>
                  {account.isActive ? t('status_active') : t('status_paused')}
                </StatusChip>
              </li>
            ))}
          </ul>
        )}

        {isConnectConfigured() && authorizeUrl ? (
          <Button variant="signal" size="lg" render={<a href={authorizeUrl}>{t('connect')}</a>} />
        ) : (
          <p className="rounded-lg border border-status-wait-border bg-status-wait p-3 text-sm text-status-wait-foreground">
            {t('unconfigured_note')}
          </p>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t('scope_note')}
      </p>
    </div>
  );
}
