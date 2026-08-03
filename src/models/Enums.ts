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

export const templateSourceEnum = cardnews.enum('template_source', ['system', 'learned', 'forked']);

export const deckStatusEnum = cardnews.enum('deck_status', [
  'drafting',
  'ready',
  'scheduled',
  'published',
  'archived',
]);

/** How much of a deck one generation touches. Drives the credit price of a run. */
export const runScopeKindEnum = cardnews.enum('run_scope_kind', ['full', 'panel', 'slot']);

export const boardRowStatusEnum = cardnews.enum('board_row_status', [
  'draft',
  'queued',
  'running',
  'done',
  'failed',
  'skipped',
]);

/**
 * `estimated` exists so a dry-run quote can be persisted before any credit
 * moves; a run only leaves it once the user accepts the estimate.
 */
export const runStatusEnum = cardnews.enum('run_status', [
  'estimated',
  'queued',
  'running',
  'done',
  'failed',
  'canceled',
]);

/**
 * A scheduled post's lifecycle.
 *
 * `publishing` exists so a worker that dies mid-send is distinguishable from
 * one that never started: the first needs a human to check whether the post
 * actually went out, and the second can simply be retried.
 */
export const scheduleStatusEnum = cardnews.enum('schedule_status', [
  'pending',
  'publishing',
  'published',
  'failed',
  'canceled',
]);

export const creditReasonEnum = cardnews.enum('credit_reason', [
  'grant.signup',
  'grant.monthly',
  'grant.purchase',
  'grant.promo',
  'spend.run',
  'spend.learn',
  'spend.search',
  'refund.run_failed',
  'refund.manual',
  'expire.monthly',
]);

/** Aspect ratio of a rendered card. Fan-out reuses one layout across all of them. */
export type Ratio = (typeof ratioEnum.enumValues)[number];
/** Destination network a card is produced for. */
export type Channel = (typeof channelEnum.enumValues)[number];
