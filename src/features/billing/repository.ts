import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import type { PlanLimit } from '@/models/Billing';
import { planLimits } from '@/models/Billing';

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
