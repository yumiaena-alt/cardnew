import { cardnews } from './Namespace';

/**
 * Shared enum definitions, declared inside the `cardnews` schema. Kept in one
 * file so a value used by several domains is created exactly once — Postgres
 * rejects duplicate type creation.
 */

export const memberRoleEnum = cardnews.enum('member_role', [
  'owner',
  'admin',
  'editor',
  'reviewer',
  'viewer',
]);

export const channelEnum = cardnews.enum('channel', [
  'instagram',
  'threads',
  'tiktok',
  'youtube',
  'blog',
]);

export const ratioEnum = cardnews.enum('ratio', ['1:1', '4:5', '16:9', '9:16', '3:4']);

export const creditReasonEnum = cardnews.enum('credit_reason', [
  'grant.signup',
  'grant.monthly',
  'grant.purchase',
  'grant.promo',
  'spend.run',
  'spend.learn',
  'refund.run_failed',
  'refund.manual',
  'expire.monthly',
]);
