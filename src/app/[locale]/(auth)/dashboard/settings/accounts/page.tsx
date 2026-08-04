import { Link2, Plug } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { findScope } from '@/features/shared/scope';
import {
  buildAuthorizeUrl,
  buildRedirectUri,
  isConnectConfigured,
} from '@/features/social/connect';
import { listSocialAccounts } from '@/features/social/repository';

/**
 * Channels this product means to support, and whether one works today.
 *
 * Instagram is the only live one. The rest are listed so the shape of the plan
 * is visible without implying they are a click away.
 */
const CHANNELS = [
  { id: 'instagram', live: true },
  { id: 'threads', live: false },
  { id: 'tiktok', live: false },
  { id: 'youtube', live: false },
] as const;

type AccountsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ connect?: string }>;
};

export default async function AccountsPage(props: AccountsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AccountsPage' });

  // Outcomes worth naming. Everything else — a refused state, a failed
  // exchange, a missing project — is a fault the reader cannot act on, and
  // describing each separately would say the same thing in more words.
  const { connect } = await props.searchParams;
  const named: Record<string, string> = {
    connected: t('result_connected'),
    canceled: t('result_canceled'),
    no_business_account: t('result_no_business_account'),
    already_connected: t('result_already_connected'),
    unconfigured: t('result_unconfigured'),
  };
  const result = connect ? (named[connect] ?? t('result_failed')) : null;
  const isConnected = connect === 'connected';

  const scope = await findScope();
  const accounts = scope ? await listSocialAccounts(scope) : [];

  const redirectUri = buildRedirectUri();
  const authorizeUrl = scope && redirectUri ? buildAuthorizeUrl(scope, redirectUri) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {result ? (
        <output
          className={
            isConnected
              ? 'block rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground'
              : 'block rounded-lg border border-status-fail-border bg-status-fail p-3 text-sm text-status-fail-foreground'
          }
        >
          {result}
        </output>
      ) : null}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        {accounts.length === 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Plug className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">{t('empty_title')}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t('empty_description')}</p>
            </div>

            {/* Every channel we intend to support, with the ones that do not work
                yet marked as such. Listing only Instagram would read as the whole
                plan; listing the rest as though they worked would be a lie. */}
            <ul className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <span
                    className={
                      entry.live ? 'text-sm text-foreground' : 'text-sm text-muted-foreground'
                    }
                  >
                    {t(`channel_${entry.id}`)}
                  </span>

                  <StatusChip tone={entry.live ? 'done' : 'wait'}>
                    {entry.live ? t('channel_ready') : t('channel_later')}
                  </StatusChip>
                </li>
              ))}
            </ul>
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
          <Button size="lg" render={<a href={authorizeUrl}>{t('connect')}</a>} />
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
