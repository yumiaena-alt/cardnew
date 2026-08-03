import { index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { deckStatusEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, projects, users } from './Org';

/**
 * Long-form drafts.
 *
 * Blog output is prose, not cards, so it does not live in `panels`. Forcing an
 * article into a panel would mean every card-shaped query has to remember that
 * some of its rows are not cards, which is the kind of thing that stays wrong
 * for a year.
 */
export const blogPosts = cardnews.table(
  'blog_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** What was asked for. Kept so a regeneration knows the original brief. */
    topic: text('topic').notNull(),
    /** The draft itself, in Markdown. */
    body: text('body').notNull(),
    status: deckStatusEnum('status').notNull().default('drafting'),
    creditsCharged: integer('credits_charged').notNull().default(0),
    /** Ledger entry that paid for this draft, for tracing a charge to its output. */
    chargeKey: text('charge_key'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('blog_posts_org_created_idx').on(t.orgId, t.createdAt)],
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
