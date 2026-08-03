import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { findDefaultProjectId } from '@/features/deck/repository';
import {
  exchangeCode,
  extendToken,
  fetchInstagramProfile,
  isConnectConfigured,
  readState,
} from '@/features/social/connect';
import { upsertSocialAccount } from '@/features/social/repository';
import { encryptSecret } from '@/libs/Crypto';
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
  // Checked before anything is exchanged. Without the encryption key the token
  // would arrive with nowhere safe to put it, and encrypting it at the last
  // step would throw after the credential already existed in this process.
  if (!isConnectConfigured()) {
    return backToAccounts('not_configured');
  }

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

  const extended = await extendToken(exchanged.accessToken);

  if (!extended.ok) {
    return backToAccounts(extended.reason);
  }

  const profile = await fetchInstagramProfile(extended.accessToken);

  if (!profile.ok) {
    return backToAccounts(profile.reason);
  }

  const scope = { orgId: verified.orgId };
  const projectId = await findDefaultProjectId(scope);

  if (!projectId) {
    logger.warn('Account callback found no project', { orgId: scope.orgId });

    return backToAccounts('no_project');
  }

  const stored = await upsertSocialAccount(scope, {
    projectId,
    channel: 'instagram',
    externalId: profile.profile.externalId,
    handle: profile.profile.handle,
    accessTokenCipher: encryptSecret(extended.accessToken),
    tokenExpiresAt: extended.expiresAt,
  });

  if (!stored) {
    logger.warn('Account already held elsewhere', { orgId: scope.orgId });

    return backToAccounts('already_connected');
  }

  logger.info('Account connected', { orgId: scope.orgId, accountId: stored.id });

  return backToAccounts('connected');
}
