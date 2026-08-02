import { boolean, index, integer, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { creditReasonEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations } from './Org';

export const subscriptions = cardnews.table(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .unique(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    planKey: text('plan_key').notNull().default('free'),
    status: text('status').notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  },
  (t) => [index('subscriptions_stripe_customer_idx').on(t.stripeCustomerId)],
);

/**
 * Credit ledger. Double-entry by design: there is no balance column, so the
 * balance is always `SUM(delta)`. A charge and its refund stay as separate rows,
 * which keeps the history auditable and makes double-charging impossible to hide.
 */
export const creditLedger = cardnews.table(
  'credit_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Positive on grant and refund, negative on spend. */
    delta: integer('delta').notNull(),
    reason: creditReasonEnum('reason').notNull(),
    refType: text('ref_type'),
    refId: uuid('ref_id'),
    /** Unique so a retried request can never post the same entry twice. */
    idempotencyKey: text('idempotency_key').notNull(),
    /** Expiry for monthly grants. Null for purchased credits. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('credit_ledger_idem_uq').on(t.idempotencyKey),
    index('credit_ledger_org_created_idx').on(t.orgId, t.createdAt),
  ],
);

export const planLimits = cardnews.table('plan_limits', {
  planKey: text('plan_key').primaryKey(),
  monthlyCredits: integer('monthly_credits').notNull(),
  maxSocialAccounts: integer('max_social_accounts').notNull(),
  maxMembers: integer('max_members').notNull(),
  maxBrandAssets: integer('max_brand_assets').notNull(),
  maxSavedTemplates: integer('max_saved_templates').notNull(),
  hasWatermark: boolean('has_watermark').notNull().default(false),
  overageCentsPerCredit: integer('overage_cents_per_credit').notNull().default(5),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type CreditEntry = typeof creditLedger.$inferSelect;
export type NewCreditEntry = typeof creditLedger.$inferInsert;
export type PlanLimit = typeof planLimits.$inferSelect;
export type CreditReason = (typeof creditReasonEnum.enumValues)[number];
