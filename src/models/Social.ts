import { boolean, index, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { channelEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, projects } from './Org';

/**
 * Connected publishing accounts and the automations that run on them.
 *
 * Access tokens are not stored in the clear. The column holds a ciphertext
 * envelope, because a leaked database should not hand over the ability to post
 * as every one of our users.
 */
export const socialAccounts = cardnews.table(
  'social_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    /** The network's own account id. */
    externalId: text('external_id').notNull(),
    handle: text('handle').notNull(),
    /** Encrypted at the application layer. Never a bare token. */
    accessTokenCipher: text('access_token_cipher'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('social_accounts_channel_external_uq').on(t.channel, t.externalId),
    index('social_accounts_org_idx').on(t.orgId),
  ],
);

/**
 * A keyword-triggered private reply.
 *
 * This is the reply-to-a-commenter flow the networks support, not outbound
 * messaging: an automation only ever answers someone who commented on the
 * owner's own post. Nothing here can start a conversation.
 */
export const dmAutomations = cardnews.table(
  'dm_automations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Post the automation watches. Null watches every post on the account. */
    externalPostId: text('external_post_id'),
    /** Lower-cased words that trigger a reply. Matched as whole words. */
    keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
    message: text('message').notNull(),
    linkUrl: text('link_url'),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('dm_automations_org_idx').on(t.orgId)],
);

/**
 * One sent reply.
 *
 * Kept for the unique index alone: a network redelivering a comment webhook
 * must not mean the same person is messaged twice.
 */
export const dmSends = cardnews.table(
  'dm_sends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => dmAutomations.id, { onDelete: 'cascade' }),
    /** The comment that triggered it. One reply per comment, ever. */
    externalCommentId: text('external_comment_id').notNull(),
    status: text('status').notNull().default('sent'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('dm_sends_comment_uq').on(t.externalCommentId)],
);

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type DmAutomation = typeof dmAutomations.$inferSelect;
export type NewDmAutomation = typeof dmAutomations.$inferInsert;
export type DmSend = typeof dmSends.$inferSelect;
