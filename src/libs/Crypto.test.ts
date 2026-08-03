import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// A real key is generated rather than mocked: the point of these tests is that
// the envelope survives a round trip and refuses a tampered one, and a fake
// cipher would prove neither.
//
// Set before the import below, not in a hook: `Env` parses the environment when
// its module is evaluated, so a hook would run after the value was already read.
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { decryptSecret, encryptSecret, isEncryptionConfigured } = await import('./Crypto');

describe('token encryption', () => {
  describe(encryptSecret, () => {
    it('round-trips a secret', () => {
      expect(decryptSecret(encryptSecret('IGQVJXa-token'))).toBe('IGQVJXa-token');
    });

    it('round-trips non-latin text', () => {
      expect(decryptSecret(encryptSecret('토큰 값'))).toBe('토큰 값');
    });

    it('never returns the plaintext', () => {
      expect(encryptSecret('IGQVJXa-token')).not.toContain('IGQVJXa-token');
    });

    // A reused nonce with one key breaks GCM outright, so two encryptions of
    // the same value must not look the same.
    it('produces a different envelope each time', () => {
      expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
    });

    it('carries the nonce and tag with the ciphertext', () => {
      expect(encryptSecret('token').split('.')).toHaveLength(3);
    });
  });

  describe(decryptSecret, () => {
    it('refuses a tampered ciphertext rather than returning other bytes', () => {
      const [iv, tag, data] = encryptSecret('token').split('.');
      const bytes = Buffer.from(data ?? '', 'base64');
      // Any change at all must fail authentication; adding one keeps the length
      // the same so the failure is the tag, not a malformed envelope.
      bytes.set([(bytes.at(0) ?? 0) === 255 ? 0 : (bytes.at(0) ?? 0) + 1], 0);

      expect(() => decryptSecret(`${iv}.${tag}.${bytes.toString('base64')}`)).toThrow(
        'Unsupported state or unable to authenticate data',
      );
    });

    it('refuses a swapped authentication tag', () => {
      const [iv, , data] = encryptSecret('token').split('.');
      const [, otherTag] = encryptSecret('other').split('.');

      expect(() => decryptSecret(`${iv}.${otherTag}.${data}`)).toThrow(
        'Unsupported state or unable to authenticate data',
      );
    });

    it('refuses an envelope missing its parts', () => {
      expect(() => decryptSecret('onlyonepart')).toThrow('Malformed ciphertext envelope');
    });
  });

  describe(isEncryptionConfigured, () => {
    it('reports configured when a key is present', () => {
      expect(isEncryptionConfigured()).toBeTruthy();
    });
  });
});
