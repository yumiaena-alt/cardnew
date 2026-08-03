import { desc, eq } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { DmAutomation, NewDmAutomation, SocialAccount } from '@/models/Social';
import { dmAutomations, socialAccounts } from '@/models/Social';

/**
 * Connected accounts and their automations.
 *
 * Access tokens are never selected here. Nothing in the app needs to read one
 * outside the publishing path, and a token that never leaves the database is a
 * token that cannot end up in a log or a server-rendered payload.
 */

export type AccountSummary = {
  id: string;
  channel: SocialAccount['channel'];
  handle: string;
  isActive: boolean;
};

/**
 * Lists the organization's connected accounts.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @returns The accounts, without their credentials.
 */
export async function listSocialAccounts(scope: OrgScope): Promise<AccountSummary[]> {
  return await db
    .select({
      id: socialAccounts.id,
      channel: socialAccounts.channel,
      handle: socialAccounts.handle,
      isActive: socialAccounts.isActive,
    })
    .from(socialAccounts)
    .where(orgScoped(scope, socialAccounts))
    .orderBy(desc(socialAccounts.connectedAt));
}

/**
 * Lists the organization's DM automations.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @returns The automations, newest first.
 */
export async function listDmAutomations(scope: OrgScope): Promise<DmAutomation[]> {
  return await db
    .select()
    .from(dmAutomations)
    .where(orgScoped(scope, dmAutomations))
    .orderBy(desc(dmAutomations.createdAt));
}

/**
 * Stores an automation.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param automation - The automation to store, minus `orgId`.
 * @returns The stored automation.
 */
export async function insertDmAutomation(
  scope: OrgScope,
  automation: Omit<NewDmAutomation, 'orgId'>,
): Promise<DmAutomation> {
  const [row] = await db
    .insert(dmAutomations)
    .values({ ...automation, orgId: scope.orgId })
    .returning();

  if (!row) {
    throw new Error('Automation insert returned no row');
  }

  return row;
}

/**
 * Turns an automation on or off.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param automationId - Automation to change.
 * @param isActive - Whether it should run.
 * @returns The updated automation, or null when it is not the caller's.
 */
export async function setAutomationActive(
  scope: OrgScope,
  automationId: string,
  isActive: boolean,
): Promise<DmAutomation | null> {
  const [row] = await db
    .update(dmAutomations)
    .set({ isActive })
    .where(orgScoped(scope, dmAutomations, eq(dmAutomations.id, automationId)))
    .returning();

  return row ?? null;
}

/**
 * Deletes an automation.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param automationId - Automation to remove.
 */
export async function deleteDmAutomation(scope: OrgScope, automationId: string): Promise<void> {
  await db
    .delete(dmAutomations)
    .where(orgScoped(scope, dmAutomations, eq(dmAutomations.id, automationId)));
}
