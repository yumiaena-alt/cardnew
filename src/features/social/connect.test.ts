import { randomBytes } from 'node:crypto';

// Set before the import: `Env` parses the environment when its module is
// evaluated, so a hook would run after these were already read.
process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { afterEach, describe, expect, it, vi } = await import('vitest');
const { buildAuthorizeUrl, createState, isConnectConfigured, readState } =
  await import('./connect');

const scope = { orgId: 'org_1' };

describe('account connection', () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
