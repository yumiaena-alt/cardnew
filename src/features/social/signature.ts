import { createHmac, timingSafeEqual } from 'node:crypto';
import { Env } from '@/libs/Env';

/**
 * Proving a webhook delivery came from Meta.
 *
 * The body decides who gets messaged in our users' names, so it is verified
 * before it is parsed. Anyone can post to a public endpoint; only the holder of
 * the app secret can sign a body for it.
 */

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Compares two strings without leaking how far they matched.
 *
 * A comparison that stops at the first wrong byte tells an attacker the length
 * of the correct prefix, which turns forging a signature into a series of cheap
 * guesses rather than one impossible one.
 *
 * @param left - First value.
 * @param right - Second value.
 * @returns True when the values are identical.
 */
function equals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verifies the signature Meta sends with a delivery.
 *
 * @param rawBody - The body exactly as received. A re-serialized object would
 * produce a different digest even when the content is the same.
 * @param header - The `x-hub-signature-256` header.
 * @returns True when the body was signed with our app secret.
 */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  if (!(Env.META_APP_SECRET && header?.startsWith(SIGNATURE_PREFIX))) {
    return false;
  }

  const expected = createHmac('sha256', Env.META_APP_SECRET).update(rawBody, 'utf-8').digest('hex');

  return equals(expected, header.slice(SIGNATURE_PREFIX.length));
}

/**
 * Whether a subscription handshake carries the token we configured.
 *
 * @param token - The `hub.verify_token` query value.
 * @returns True when it matches, and false when no token is configured at all.
 */
export function matchesVerifyToken(token: string | null): boolean {
  if (!(Env.META_WEBHOOK_VERIFY_TOKEN && token)) {
    return false;
  }

  return equals(Env.META_WEBHOOK_VERIFY_TOKEN, token);
}
