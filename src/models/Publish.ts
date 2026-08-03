import { index, integer, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { decks } from './Deck';
import { scheduleStatusEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, users } from './Org';
import { socialAccounts } from './Social';

/**
 * Scheduled posts and the posts they became.
 *
 * Two tables rather than one status column on a deck: a deck goes out to
 * several accounts on different days, and the record of what was actually
 * published has to outlive the intent that produced it. Deleting a schedule
 * must never delete the evidence that something was posted.
 */
export const schedules = cardnews.table(
  'schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    caption: text('caption'),
    hashtags: jsonb('hashtags').$type<string[]>().notNull().default([]),
    status: scheduleStatusEnum('status').notNull().default('pending'),
    /** Counted so a post that keeps failing stops being retried forever. */
    attempts: integer('attempts').notNull().default(0),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /** The poller's query: everything pending whose time has come. */
    index('schedules_due_idx').on(t.status, t.scheduledAt),
    index('schedules_org_scheduled_idx').on(t.orgId, t.scheduledAt),
    /**
     * One schedule per deck, account and instant. A double click on the
     * schedule button is the ordinary way this happens, and the second one
     * would post the same cards twice.
     */
    uniqueIndex('schedules_deck_account_at_uq').on(t.deckId, t.socialAccountId, t.scheduledAt),
  ],
);

/**
 * A post that actually went out.
 *
 * The unique index is the last line of defence against double posting: a worker
 * that published and then died before recording it retries, and the network
 * hands back the same post id rather than creating a second one.
 */
export const publications = cardnews.table(
  'publications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Null once the schedule is gone. The publication itself is kept. */
    scheduleId: uuid('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    socialAccountId: uuid('social_account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    externalPostId: text('external_post_id').notNull(),
    permalink: text('permalink'),
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('publications_account_external_uq').on(t.socialAccountId, t.externalPostId),
    index('publications_org_published_idx').on(t.orgId, t.publishedAt),
  ],
);

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Publication = typeof publications.$inferSelect;
