import { randomBytes } from 'node:crypto';

// Set before the import: `Env` parses the environment when its module is
// evaluated, so a hook would run after these were already read.
process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { afterEach, describe, expect, it, vi } = await import('vitest');
const {
  buildAuthorizeUrl,
  toCallbackUrl,
  createState,
  extendToken,
  fetchInstagramProfile,
  isConnectConfigured,
  readState,
} = await import('./connect');

const scope = { orgId: 'org_1' };

/**
 * Answers the next Graph call with a fixed body.
 *
 * @param body - What the API returns.
 * @param ok - Whether the response succeeds.
 */
function respondWith(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      json: vi.fn().mockResolvedValue(body),
    }),
  );
}

describe('account connection', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe(readState, () => {
    it('reads back the organization it was created for', () => {
      expect(readState(createState(scope))).toStrictEqual({ ok: true, orgId: 'org_1' });
    });

    // Without the signature check, sending someone a callback URL naming your
    // own organization would attach their account to it.
    it('refuses a state whose organization was swapped', () => {
      const forged = `${Buffer.from(JSON.stringify({ orgId: 'org_attacker', nonce: 'x', at: Date.now() })).toString('base64url')}.notasignature`;

      expect(readState(forged)).toStrictEqual({ ok: false, reason: 'invalid_state' });
    });

    it('refuses a state with no signature at all', () => {
      expect(readState('justpayload')).toStrictEqual({ ok: false, reason: 'invalid_state' });
    });

    it('refuses a tampered signature of the right shape', () => {
      const state = createState(scope);
      const tampered = `${state.slice(0, -1)}${state.endsWith('A') ? 'B' : 'A'}`;

      expect(readState(tampered)).toStrictEqual({ ok: false, reason: 'invalid_state' });
    });

    it('refuses a state that sat around too long', () => {
      const state = createState(scope);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 11 * 60 * 1000);

      expect(readState(state)).toStrictEqual({ ok: false, reason: 'expired_state' });
    });
  });

  describe(buildAuthorizeUrl, () => {
    it('reports configured when the app credentials and a key are present', () => {
      expect(isConnectConfigured()).toBeTruthy();
    });

    it('sends the state along so the callback can be trusted', () => {
      const url = buildAuthorizeUrl(scope, 'https://example.com/cb');
      const state = new URL(url ?? '').searchParams.get('state');

      expect(readState(state ?? '')).toMatchObject({ ok: true, orgId: 'org_1' });
    });

    it('asks only for the scopes the product uses', () => {
      const url = new URL(buildAuthorizeUrl(scope, 'https://example.com/cb') ?? '');

      expect(url.searchParams.get('scope')).toBe(
        'instagram_basic,instagram_manage_comments,instagram_content_publish,pages_show_list',
      );
    });
  });

  describe(extendToken, () => {
    // A stored token with no expiry would never be refreshed before it lapses.
    it('carries the expiry the provider reports', async () => {
      respondWith({ access_token: 'long-lived', expires_in: 60 });

      const result = await extendToken('short-lived');

      expect(result).toMatchObject({ ok: true, accessToken: 'long-lived' });
      expect(result.ok && result.expiresAt).toBeInstanceOf(Date);
    });

    it('refuses a response carrying no token', async () => {
      respondWith({ error: { message: 'bad token' } });

      await expect(extendToken('short-lived')).resolves.toStrictEqual({
        ok: false,
        reason: 'exchange_failed',
      });
    });
  });

  describe(fetchInstagramProfile, () => {
    it('reads the account linked to a page', async () => {
      respondWith({
        data: [
          { id: 'page_1' },
          { id: 'page_2', instagram_business_account: { id: '17841', username: 'panelo' } },
        ],
      });

      await expect(fetchInstagramProfile('token')).resolves.toStrictEqual({
        ok: true,
        profile: { externalId: '17841', handle: 'panelo' },
      });
    });

    // The id is what everything downstream keys on, so a missing handle is a
    // cosmetic gap rather than a reason to refuse the connection.
    it('falls back to the account id when no handle is returned', async () => {
      respondWith({ data: [{ instagram_business_account: { id: '17841' } }] });

      await expect(fetchInstagramProfile('token')).resolves.toStrictEqual({
        ok: true,
        profile: { externalId: '17841', handle: '17841' },
      });
    });

    it('separates a page with no linked account from a failed call', async () => {
      respondWith({ data: [{ id: 'page_1' }] });

      await expect(fetchInstagramProfile('token')).resolves.toStrictEqual({
        ok: false,
        reason: 'no_business_account',
      });
    });

    it('refuses a call the provider rejected', async () => {
      respondWith({ error: { message: 'expired' } }, false);

      await expect(fetchInstagramProfile('token')).resolves.toStrictEqual({
        ok: false,
        reason: 'profile_failed',
      });
    });
  });
});

describe(toCallbackUrl, () => {
  it('builds an absolute callback from the app address', () => {
    expect(toCallbackUrl('https://panelo.example')).toBe(
      'https://panelo.example/api/oauth/instagram/callback',
    );
  });

  it('drops a trailing slash rather than doubling it', () => {
    expect(toCallbackUrl('https://panelo.example/')).toBe(
      'https://panelo.example/api/oauth/instagram/callback',
    );
  });

  // A relative redirect_uri reaches Meta as a message about app domains, which
  // sends whoever reads it into the Meta dashboard hunting a problem that is
  // not there.
  it('refuses to build one without an app address', () => {
    expect(toCallbackUrl()).toBeNull();
  });

  it('treats a blank address as unset', () => {
    expect(toCallbackUrl('   ')).toBeNull();
  });
});
