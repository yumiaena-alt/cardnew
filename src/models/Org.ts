import { boolean, index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { memberRoleEnum } from './Enums';
import { cardnews } from './Namespace';

/**
 * A Clerk Organization mirrored into our database. Every row that belongs to a
 * tenant carries `orgId` directly so isolation filters never need a join.
 */
export const organizations = cardnews.table('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  planKey: text('plan_key').notNull().default('free'),
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const users = cardnews.table('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  locale: text('locale').notNull().default('ko'),
  /** Marketing consent timestamp. Null means no consent. Kept for legal proof. */
  marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
  /** Deletion request time. A scheduled job hard-deletes after a 30-day grace period. */
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = cardnews.table(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('editor'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_uq').on(t.orgId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

/**
 * Brand-level container. Phase 1~3 auto-creates exactly one (`default`) per
 * organization and hides the switcher; the schema already supports the
 * multi-brand agency case so enabling it later needs no migration.
 */
export const projects = cardnews.table(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('projects_org_idx').on(t.orgId)],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
