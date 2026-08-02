import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Shared enum definitions. Kept in one file so a value used by several domains
 * is declared exactly once — Postgres rejects duplicate type creation.
 */

export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'admin',
  'editor',
  'reviewer',
  'viewer',
]);

export const channelEnum = pgEnum('channel', ['instagram', 'threads', 'tiktok', 'youtube', 'blog']);

export const ratioEnum = pgEnum('ratio', ['1:1', '4:5', '16:9', '9:16', '3:4']);

export const creditReasonEnum = pgEnum('credit_reason', [
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
