import { and, desc, eq } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { Channel } from '@/models/Enums';
import type { DmAutomation, DmSend, NewDmAutomation, SocialAccount } from '@/models/Social';
import { dmAutomations, dmSends, socialAccounts } from '@/models/Social';

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

export type ConnectAccountInput = {
  projectId: string;
  channel: SocialAccount['channel'];
  /** The network's own account id. Stable across handle changes. */
  externalId: string;
  handle: string;
  accessTokenCipher: string;
  tokenExpiresAt: Date | null;
};

/**
 * Stores a freshly authorized account, replacing an earlier connection to it.
 *
 * Reconnecting is the normal way a user fixes an expired token, so the same
 * account arriving twice updates the row rather than failing. It only does so
 * for the organization that already holds it: the uniqueness of an account is
 * global, and without the guard a second organization connecting the same
 * profile would silently take it over — along with its automations.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The account and its encrypted credential.
 * @returns The stored account, or null when another organization holds it.
 */
export async function upsertSocialAccount(
  scope: OrgScope,
  input: ConnectAccountInput,
): Promise<SocialAccount | null> {
  const [row] = await db
    .insert(socialAccounts)
    .values({ ...input, orgId: scope.orgId, isActive: true })
    .onConflictDoUpdate({
      target: [socialAccounts.channel, socialAccounts.externalId],
      set: {
        projectId: input.projectId,
        handle: input.handle,
        accessTokenCipher: input.accessTokenCipher,
        tokenExpiresAt: input.tokenExpiresAt,
        isActive: true,
        connectedAt: new Date(),
      },
      // The isolation filter, written out rather than composed through
      // `orgScoped()`: this guards a conflict clause, not a query.
      setWhere: eq(socialAccounts.orgId, scope.orgId),
    })
    .returning();

  return row ?? null;
}

export type AccountCredential = {
  id: string;
  orgId: string;
  externalId: string;
  accessTokenCipher: string | null;
  isActive: boolean;
};

/**
 * Resolves the account a webhook delivery is about.
 *
 * Deliberately not scoped: this is the step that *establishes* the tenant. A
 * webhook arrives with the network's account id and nothing else, and the row
 * it finds is what every scoped query after it is filtered by.
 *
 * The token comes back here because this is the one path that has to use it.
 *
 * @param channel - Which network the delivery came from.
 * @param externalId - The network's own account id.
 * @returns The account and its stored credential, or null when it is unknown.
 */
export async function findAccountByExternalId(
  channel: Channel,
  externalId: string,
): Promise<AccountCredential | null> {
  const [row] = await db
    .select({
      id: socialAccounts.id,
      orgId: socialAccounts.orgId,
      externalId: socialAccounts.externalId,
      accessTokenCipher: socialAccounts.accessTokenCipher,
      isActive: socialAccounts.isActive,
    })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.channel, channel), eq(socialAccounts.externalId, externalId)))
    .limit(1);

  return row ?? null;
}

/**
 * Lists the automations that are switched on for one account.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param accountId - The account the comment landed on.
 * @returns The active automations, oldest first so the first rule a user wrote wins.
 */
export async function listActiveAutomations(
  scope: OrgScope,
  accountId: string,
): Promise<DmAutomation[]> {
  return await db
    .select()
    .from(dmAutomations)
    .where(
      orgScoped(
        scope,
        dmAutomations,
        eq(dmAutomations.accountId, accountId),
        eq(dmAutomations.isActive, true),
      ),
    )
    .orderBy(dmAutomations.createdAt);
}

/**
 * Claims the right to answer one comment.
 *
 * Written before the reply is sent, not after. The network redelivers a webhook
 * it did not hear back from, and a record written afterwards would leave a
 * window where the same person is messaged twice — the one failure mode of this
 * feature a user would notice and never forgive.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The automation that matched and the comment it matched.
 * @returns The claim, or null when this comment was already answered.
 */
export async function claimDmSend(
  scope: OrgScope,
  input: { automationId: string; externalCommentId: string },
): Promise<DmSend | null> {
  const [row] = await db
    .insert(dmSends)
    .values({
      orgId: scope.orgId,
      automationId: input.automationId,
      externalCommentId: input.externalCommentId,
      status: 'sending',
    })
    .onConflictDoNothing({ target: dmSends.externalCommentId })
    .returning();

  return row ?? null;
}

/**
 * Records how a claimed send turned out.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param sendId - The claim to update.
 * @param outcome - The final status and, when it failed, the provider's reason.
 */
export async function settleDmSend(
  scope: OrgScope,
  sendId: string,
  outcome: { status: 'sent' | 'failed'; errorMessage?: string },
): Promise<void> {
  await db
    .update(dmSends)
    .set({ status: outcome.status, errorMessage: outcome.errorMessage ?? null })
    .where(orgScoped(scope, dmSends, eq(dmSends.id, sendId)));
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
