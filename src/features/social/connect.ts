import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { OrgScope } from '@/features/shared/scope';
import { isEncryptionConfigured } from '@/libs/Crypto';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

/**
 * Connecting a publishing account.
 *
 * The organization has to survive the round trip to the provider and come back
 * trustworthy, so it travels in a signed state parameter rather than a session
 * or a plain query value. Without the signature, anyone could send a victim a
 * callback URL naming their own organization and have the victim's account
 * attached to it.
 */

const AUTHORIZE_ENDPOINT = 'https://www.facebook.com/v21.0/dialog/oauth';
const TOKEN_ENDPOINT = 'https://graph.facebook.com/v21.0/oauth/access_token';

/** Read comments, reply to them, and publish. Nothing broader is requested. */
const SCOPES = [
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_content_publish',
  'pages_show_list',
].join(',');

/** Short enough that a stale callback is refused rather than honoured. */
const STATE_TTL_MS = 10 * 60 * 1000;

export type ConnectFailure =
  | 'not_configured'
  | 'invalid_state'
  | 'expired_state'
  | 'exchange_failed';

/**
 * Whether the connection flow can run.
 *
 * Encryption counts: without a key there is nowhere safe to put the token that
 * comes back, and connecting only to store a bare credential is worse than not
 * connecting at all.
 *
 * @returns True when the app credentials and an encryption key are present.
 */
export function isConnectConfigured(): boolean {
  return Boolean(Env.META_APP_ID && Env.META_APP_SECRET && isEncryptionConfigured());
}

/**
 * Signs the state that travels to the provider and back.
 *
 * @param payload - The value to protect.
 * @returns The payload with its signature appended.
 */
function sign(payload: string): string {
  const secret = Env.META_APP_SECRET ?? '';
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');

  return `${payload}.${mac}`;
}

/**
 * Builds the state parameter: organization, nonce, and issue time, signed.
 *
 * @param scope - The organization starting the connection.
 * @returns The signed state.
 */
export function createState(scope: OrgScope): string {
  const payload = Buffer.from(
    JSON.stringify({ orgId: scope.orgId, nonce: randomBytes(8).toString('hex'), at: Date.now() }),
  ).toString('base64url');

  return sign(payload);
}

/**
 * Verifies a returned state and reads the organization out of it.
 *
 * Compared in constant time: a byte-by-byte comparison that bails on the first
 * mismatch tells an attacker how much of a forged signature was right.
 *
 * @param state - The state the provider sent back.
 * @returns The organization id, or why the state was refused.
 */
export function readState(
  state: string,
): { ok: true; orgId: string } | { ok: false; reason: ConnectFailure } {
  const separator = state.lastIndexOf('.');

  if (separator === -1) {
    return { ok: false, reason: 'invalid_state' };
  }

  const payload = state.slice(0, separator);
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(state);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'invalid_state' };
  }

  const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('orgId' in decoded) ||
    typeof decoded.orgId !== 'string' ||
    !('at' in decoded) ||
    typeof decoded.at !== 'number'
  ) {
    return { ok: false, reason: 'invalid_state' };
  }

  if (Date.now() - decoded.at > STATE_TTL_MS) {
    return { ok: false, reason: 'expired_state' };
  }

  return { ok: true, orgId: decoded.orgId };
}

/**
 * Builds the URL that starts the connection.
 *
 * @param scope - The organization connecting.
 * @param redirectUri - Where the provider returns the user.
 * @returns The authorize URL, or null when the flow is unconfigured.
 */
export function buildAuthorizeUrl(scope: OrgScope, redirectUri: string): string | null {
  if (!(isConnectConfigured() && Env.META_APP_ID)) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: Env.META_APP_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_type: 'code',
    state: createState(scope),
  });

  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for an access token.
 *
 * @param code - The code the provider returned.
 * @param redirectUri - The same redirect used to obtain the code.
 * @returns The token, or why the exchange failed.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; reason: ConnectFailure }> {
  if (!(Env.META_APP_ID && Env.META_APP_SECRET)) {
    return { ok: false, reason: 'not_configured' };
  }

  const params = new URLSearchParams({
    client_id: Env.META_APP_ID,
    client_secret: Env.META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${TOKEN_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('Account token exchange failed', { status: response?.status ?? 0 });

    return { ok: false, reason: 'exchange_failed' };
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('access_token' in payload) ||
    typeof payload.access_token !== 'string'
  ) {
    return { ok: false, reason: 'exchange_failed' };
  }

  return { ok: true, accessToken: payload.access_token };
}
