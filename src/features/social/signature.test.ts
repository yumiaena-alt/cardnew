import { createHmac } from 'node:crypto';

// Set before the import: `Env` parses the environment when its module is
// evaluated, so a hook would run after these were already read.
process.env.META_APP_SECRET = 'test-app-secret';
process.env.META_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';

const { describe, expect, it } = await import('vitest');
const { matchesVerifyToken, verifyMetaSignature } = await import('./signature');

const body = JSON.stringify({ object: 'instagram', entry: [] });

/**
 * Signs a body the way Meta does.
 *
 * @param payload - The body to sign.
 * @param secret - The signing secret.
 * @returns The header value.
 */
function signatureFor(payload: string, secret = 'test-app-secret') {
  return `sha256=${createHmac('sha256', secret).update(payload, 'utf-8').digest('hex')}`;
}

describe('webhook signature', () => {
  describe(verifyMetaSignature, () => {
    it('accepts a body signed with the app secret', () => {
      expect(verifyMetaSignature(body, signatureFor(body))).toBeTruthy();
    });

    // The point of verifying at all: a body anyone can post decides who gets
    // messaged in the account owner's name.
    it('refuses a body that changed after it was signed', () => {
      const signature = signatureFor(body);

      expect(verifyMetaSignature(`${body} `, signature)).toBeFalsy();
    });

    it('refuses a signature made with another secret', () => {
      expect(verifyMetaSignature(body, signatureFor(body, 'someone-elses-secret'))).toBeFalsy();
    });

    it('refuses a delivery with no signature header', () => {
      expect(verifyMetaSignature(body, null)).toBeFalsy();
    });

    it('refuses a digest sent without its algorithm prefix', () => {
      expect(verifyMetaSignature(body, signatureFor(body).slice('sha256='.length))).toBeFalsy();
    });
  });

  describe(matchesVerifyToken, () => {
    it('accepts the configured token', () => {
      expect(matchesVerifyToken('test-verify-token')).toBeTruthy();
    });

    it('refuses a token that only shares a prefix', () => {
      expect(matchesVerifyToken('test-verify')).toBeFalsy();
    });

    it('refuses a handshake carrying no token', () => {
      expect(matchesVerifyToken(null)).toBeFalsy();
    });
  });
});
