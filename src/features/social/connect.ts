import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { OrgScope } from '@/features/shared/scope';
import { isEncryptionConfigured } from '@/libs/Crypto';
import { Env } from '@/libs/Env';
import { GRAPH_BASE, getGraph } from './graph';

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
const TOKEN_ENDPOINT = `${GRAPH_BASE}/oauth/access_token`;
const ACCOUNTS_ENDPOINT = `${GRAPH_BASE}/me/accounts`;

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
  | 'exchange_failed'
  | 'profile_failed'
  | 'no_business_account';

/** What the network calls the account, and what the owner calls it. */
export type ConnectedProfile = {
  externalId: string;
  handle: string;
};

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

/** Where the provider returns the user after they approve. */
const CALLBACK_PATH = '/api/oauth/instagram/callback';

/**
 * Builds the absolute callback URL the provider must return to.
 *
 * Null rather than a relative path when the app's own address is unknown. Meta
 * rejects a relative `redirect_uri` with a message about app domains, which
 * reads as a misconfigured Meta app rather than a variable missing on our side
 * — so an unset address has to stop the flow here, where the screen can say so,
 * instead of surfacing as somebody else's error two redirects later.
 *
 * @param origin - The app's own address, if configured.
 * @returns The absolute callback URL, or null when the app address is unset.
 */
export function toCallbackUrl(origin?: string): string | null {
  const trimmed = origin?.trim();

  if (trimmed === undefined || trimmed === '') {
    return null;
  }

  return `${trimmed.replace(/\/+$/u, '')}${CALLBACK_PATH}`;
}

/**
 * The callback URL for this deployment.
 *
 * @returns The absolute callback URL, or null when the app address is unset.
 */
export function buildRedirectUri(): string | null {
  return toCallbackUrl(Env.NEXT_PUBLIC_APP_URL);
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

/** An access token and the moment it stops working, when the provider says so. */
type IssuedToken = {
  accessToken: string;
  expiresAt: Date | null;
};

export type TokenResult = ({ ok: true } & IssuedToken) | { ok: false; reason: ConnectFailure };

/**
 * Reads a token out of a Graph token response.
 *
 * @param payload - The decoded body.
 * @returns The token and its expiry, or null when the body carries no token.
 */
function readToken(payload: unknown): IssuedToken | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('access_token' in payload) ||
    typeof payload.access_token !== 'string'
  ) {
    return null;
  }

  const seconds =
    'expires_in' in payload && typeof payload.expires_in === 'number' ? payload.expires_in : null;

  return {
    accessToken: payload.access_token,
    expiresAt: seconds === null ? null : new Date(Date.now() + seconds * 1000),
  };
}

/**
 * Exchanges an authorization code for an access token.
 *
 * @param code - The code the provider returned.
 * @param redirectUri - The same redirect used to obtain the code.
 * @returns The token, or why the exchange failed.
 */
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
  if (!(Env.META_APP_ID && Env.META_APP_SECRET)) {
    return { ok: false, reason: 'not_configured' };
  }

  const params = new URLSearchParams({
    client_id: Env.META_APP_ID,
    client_secret: Env.META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const token = readToken(
    await getGraph(`${TOKEN_ENDPOINT}?${params.toString()}`, 'code exchange'),
  );

  return token ? { ok: true, ...token } : { ok: false, reason: 'exchange_failed' };
}

/**
 * Trades the code's short-lived token for a long-lived one.
 *
 * The token that comes straight out of the code expires in about an hour, so
 * storing it would produce a connection that is already broken by the time
 * anyone publishes through it. The long-lived token lasts about sixty days,
 * which is what makes the stored credential worth encrypting and keeping.
 *
 * @param shortLivedToken - The token from the code exchange.
 * @returns The long-lived token, or why the exchange failed.
 */
export async function extendToken(shortLivedToken: string): Promise<TokenResult> {
  if (!(Env.META_APP_ID && Env.META_APP_SECRET)) {
    return { ok: false, reason: 'not_configured' };
  }

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: Env.META_APP_ID,
    client_secret: Env.META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const token = readToken(await getGraph(`${TOKEN_ENDPOINT}?${params.toString()}`, 'token extend'));

  return token ? { ok: true, ...token } : { ok: false, reason: 'exchange_failed' };
}

/**
 * Reads the Instagram account linked to one page.
 *
 * @param page - A raw entry from the pages listing.
 * @returns The profile, or null when the page has no Instagram account.
 */
function readProfile(page: unknown): ConnectedProfile | null {
  if (typeof page !== 'object' || page === null || !('instagram_business_account' in page)) {
    return null;
  }

  const account = page.instagram_business_account;

  if (
    typeof account !== 'object' ||
    account === null ||
    !('id' in account) ||
    typeof account.id !== 'string'
  ) {
    return null;
  }

  const username =
    'username' in account && typeof account.username === 'string' ? account.username : '';

  return { externalId: account.id, handle: username === '' ? account.id : username };
}

/**
 * Reads the Instagram profile attached to the authorizing user's pages.
 *
 * Instagram's own id and handle are what everything downstream keys on: a
 * comment webhook names an account id, not a page. Only a professional account
 * linked to a page is reachable this way, which is a Meta constraint rather
 * than ours — a personal account has no comment or publishing API at all.
 *
 * @param accessToken - A token from the connection flow.
 * @returns The profile, or why it could not be read.
 */
export async function fetchInstagramProfile(
  accessToken: string,
): Promise<{ ok: true; profile: ConnectedProfile } | { ok: false; reason: ConnectFailure }> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'instagram_business_account{id,username}',
  });

  const payload = await getGraph(`${ACCOUNTS_ENDPOINT}?${params.toString()}`, 'profile lookup');

  if (payload === null) {
    return { ok: false, reason: 'profile_failed' };
  }

  const pages =
    typeof payload === 'object' && payload !== null && 'data' in payload ? payload.data : null;

  if (!Array.isArray(pages)) {
    return { ok: false, reason: 'profile_failed' };
  }

  const profile = pages.map(readProfile).find((entry) => entry !== null);

  return profile ? { ok: true, profile } : { ok: false, reason: 'no_business_account' };
}
