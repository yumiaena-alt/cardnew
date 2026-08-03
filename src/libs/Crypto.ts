import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Env } from './Env';

/**
 * Application-level encryption for stored third-party credentials.
 *
 * Access tokens let anyone holding them post as our users, so they are never
 * written in the clear. Encrypting in the application rather than relying on
 * disk encryption is what makes a leaked backup, a misconfigured read replica
 * or an over-broad query useless to whoever ends up with it.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt instead
 * of quietly producing different bytes.
 */

const ALGORITHM = 'aes-256-gcm';

/** GCM's standard nonce length. Fresh per message, never reused with one key. */
const IV_BYTES = 12;
const KEY_BYTES = 32;
const AUTH_TAG_BYTES = 16;

/**
 * Reads the encryption key.
 *
 * @returns The 32-byte key.
 * @throws Error when no key is configured, or it is the wrong length.
 */
function requireKey(): Buffer {
  if (!Env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  }

  const key = Buffer.from(Env.TOKEN_ENCRYPTION_KEY, 'base64');

  if (key.length !== KEY_BYTES) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  }

  return key;
}

/**
 * Whether credentials can be stored at all.
 *
 * @returns True when an encryption key is configured.
 */
export function isEncryptionConfigured(): boolean {
  return Boolean(Env.TOKEN_ENCRYPTION_KEY);
}

/**
 * Encrypts a secret for storage.
 *
 * The nonce and authentication tag travel with the ciphertext in one string, so
 * a caller cannot store the ciphertext and lose the pieces needed to read it.
 *
 * @param plaintext - The secret to protect.
 * @returns A `iv.tag.ciphertext` triple, base64 encoded.
 * @throws Error when no usable key is configured.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, requireKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);

  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

/**
 * Decrypts a stored secret.
 *
 * @param envelope - The value produced by `encryptSecret`.
 * @returns The original secret.
 * @throws Error when the envelope is malformed or fails authentication.
 */
export function decryptSecret(envelope: string): string {
  const [ivPart, tagPart, dataPart] = envelope.split('.');

  if (!(ivPart && tagPart && dataPart)) {
    throw new Error('Malformed ciphertext envelope');
  }

  const tag = Buffer.from(tagPart, 'base64');

  if (tag.length !== AUTH_TAG_BYTES) {
    throw new Error('Malformed authentication tag');
  }

  const decipher = createDecipheriv(ALGORITHM, requireKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf-8');
}
