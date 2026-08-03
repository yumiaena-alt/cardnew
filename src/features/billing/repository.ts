import { eq } from 'drizzle-orm';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { PlanLimit } from '@/models/Billing';
import { planLimits, subscriptions } from '@/models/Billing';

/**
 * Plan configuration access.
 *
 * `plan_limits` is global rather than per-tenant, so these reads take no scope.
 * Allowances live in the table instead of in constants: changing what a plan
 * includes must be a data change, not a deploy.
 */

/**
 * Looks up a plan's allowances.
 *
 * @param planKey - Plan identifier stored on the organization.
 * @returns The plan row, or null when the key is not configured.
 */
export async function findPlanLimit(planKey: string): Promise<PlanLimit | null> {
  const [row] = await db.select().from(planLimits).where(eq(planLimits.planKey, planKey)).limit(1);

  return row ?? null;
}

export type SubscriptionPatch = {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planKey: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Stores the organization's subscription, replacing any earlier one.
 *
 * One subscription per organization is enforced by a unique index on `org_id`,
 * so an upsert is the whole operation: a plan change rewrites the row rather
 * than accumulating history that nothing reads.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param patch - The subscription state reported by Stripe.
 */
export async function upsertSubscription(scope: OrgScope, patch: SubscriptionPatch): Promise<void> {
  await db
    .insert(subscriptions)
    .values({ ...patch, orgId: scope.orgId })
    .onConflictDoUpdate({ target: subscriptions.orgId, set: patch });
}
