import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { exchangeCode, readState } from '@/features/social/connect';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

/**
 * Account connection callback.
 *
 * The organization comes from the signed state, never from a query parameter
 * and never from the session: the user finishing this request is whoever the
 * provider redirected, and trusting either would let a crafted callback attach
 * someone else's account to an organization of the attacker's choosing.
 */

/**
 * Sends the user back to the accounts screen with an outcome to display.
 *
 * @param outcome - What to report.
 * @returns The redirect.
 */
function backToAccounts(outcome: string) {
  const origin = Env.NEXT_PUBLIC_APP_URL ?? '';

  return NextResponse.redirect(`${origin}/dashboard/settings/accounts?connect=${outcome}`);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');

  // The provider reports a refusal by redirecting here with `error`, which is a
  // normal outcome rather than a failure worth logging as one.
  if (params.get('error')) {
    return backToAccounts('canceled');
  }

  if (!(code && state)) {
    return backToAccounts('invalid');
  }

  const verified = readState(state);

  if (!verified.ok) {
    logger.warn('Account callback refused', { reason: verified.reason });

    return backToAccounts(verified.reason);
  }

  const redirectUri = `${Env.NEXT_PUBLIC_APP_URL ?? ''}/api/oauth/instagram/callback`;
  const exchanged = await exchangeCode(code, redirectUri);

  if (!exchanged.ok) {
    return backToAccounts(exchanged.reason);
  }

  // Storing the account needs the provider's own id and handle, which is a
  // second call against the Graph API. Until that lands the token is discarded
  // rather than parked somewhere it would sit unencrypted.
  logger.info('Account authorized', { orgId: verified.orgId });

  return backToAccounts('pending_profile');
}
