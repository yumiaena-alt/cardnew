import { and, eq, isNull } from 'drizzle-orm';
import { conflictError } from '@/features/shared/errors';
import { db } from '@/libs/DB';
import type { MemberRole } from '@/models/Org';
import { memberships, organizations, projects, users } from '@/models/Org';
import { webhookEvents } from '@/models/System';

/**
 * Tenant replica repository.
 *
 * Unlike the feature repositories that follow, these functions do not take a
 * `Scope`: they run from the Clerk webhook, which is what *creates* the tenant
 * in the first place, so there is no scope to resolve yet. They are keyed by
 * Clerk ids and are safe to replay.
 */

const DEFAULT_PROJECT_NAME = 'default';

export type ScopeIdentity = {
  orgId: string;
  userId: string;
  planKey: string;
};

type OrgUserIds = {
  orgId: string;
  userId: string;
};

/**
 * Resolves our own organization and user ids for a Clerk session pair, but only
 * when a membership actually links them.
 *
 * @param input - Clerk organization and user ids from the server session.
 * @returns The internal ids, or null when the pair has no live membership.
 */
export async function findScopeIdentity(input: {
  clerkOrgId: string;
  clerkUserId: string;
}): Promise<ScopeIdentity | null> {
  const [row] = await db
    .select({ orgId: organizations.id, userId: users.id, planKey: organizations.planKey })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(organizations.clerkOrgId, input.clerkOrgId),
        eq(users.clerkUserId, input.clerkUserId),
        isNull(organizations.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

async function findOrgUserIds(input: {
  clerkOrgId: string;
  clerkUserId: string;
}): Promise<OrgUserIds | null> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, input.clerkOrgId))
    .limit(1);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, input.clerkUserId))
    .limit(1);

  if (!(org && user)) {
    return null;
  }

  return { orgId: org.id, userId: user.id };
}

/**
 * Replicates a Clerk user. Replaying the same event is a no-op beyond rewriting
 * the same values.
 *
 * @param input - Clerk user id plus the fields we persist.
 */
export async function upsertUser(input: {
  clerkUserId: string;
  email: string;
  displayName: string | null;
}): Promise<void> {
  await db
    .insert(users)
    .values({
      clerkUserId: input.clerkUserId,
      email: input.email,
      displayName: input.displayName,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { email: input.email, displayName: input.displayName },
    });
}

/**
 * Records a deletion request instead of removing the row. The user's content
 * stays attributable until the grace-period job hard-deletes it.
 *
 * @param clerkUserId - Clerk id of the deleted user.
 */
export async function markUserDeletionRequested(clerkUserId: string): Promise<void> {
  await db
    .update(users)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(users.clerkUserId, clerkUserId));
}

/**
 * Replicates a Clerk organization, clearing any earlier soft delete so a
 * re-created organization becomes usable again.
 *
 * @param input - Clerk organization id plus the fields we persist.
 * @returns The internal organization id and the plan it is on.
 */
export async function upsertOrganization(input: {
  clerkOrgId: string;
  name: string;
  slug: string;
}): Promise<{ id: string; planKey: string }> {
  const [row] = await db
    .insert(organizations)
    .values({ clerkOrgId: input.clerkOrgId, name: input.name, slug: input.slug })
    .onConflictDoUpdate({
      target: organizations.clerkOrgId,
      set: { name: input.name, slug: input.slug, deletedAt: null },
    })
    .returning({ id: organizations.id, planKey: organizations.planKey });

  if (!row) {
    throw conflictError(`Organization upsert returned no row for ${input.clerkOrgId}`);
  }

  return row;
}

/**
 * Soft-deletes an organization. Tenant rows stay in place so billing history
 * and audit logs survive, while `findScopeIdentity` stops resolving it.
 *
 * @param clerkOrgId - Clerk id of the deleted organization.
 */
export async function softDeleteOrganization(clerkOrgId: string): Promise<void> {
  await db
    .update(organizations)
    .set({ deletedAt: new Date() })
    .where(eq(organizations.clerkOrgId, clerkOrgId));
}

/**
 * Creates the organization's single default project if it has none.
 *
 * The partial unique index on `projects` makes the insert the arbiter, so two
 * concurrent deliveries cannot both win.
 *
 * @param orgId - Internal organization id.
 */
export async function ensureDefaultProject(orgId: string): Promise<void> {
  await db
    .insert(projects)
    .values({ orgId, name: DEFAULT_PROJECT_NAME, isDefault: true })
    // `where` is the partial index predicate, so the conflict resolves against
    // `projects_org_default_uq` rather than the whole table.
    .onConflictDoNothing({ target: projects.orgId, where: eq(projects.isDefault, true) });
}

/**
 * Replicates an organization membership.
 *
 * @param input - Clerk ids of the pair plus the mapped tenant role.
 * @throws DomainError `conflict` when the organization or user has not been replicated
 * yet. Clerk does not guarantee delivery order, so the caller turns this into a
 * retryable response rather than dropping the membership.
 */
export async function upsertMembership(input: {
  clerkOrgId: string;
  clerkUserId: string;
  role: MemberRole;
}): Promise<void> {
  const ids = await findOrgUserIds(input);

  if (!ids) {
    throw conflictError(
      `Membership for org ${input.clerkOrgId} arrived before its organization or user`,
    );
  }

  await db
    .insert(memberships)
    .values({ orgId: ids.orgId, userId: ids.userId, role: input.role })
    .onConflictDoUpdate({
      target: [memberships.orgId, memberships.userId],
      set: { role: input.role },
    });
}

/**
 * Removes a membership. A pair we never replicated is already in the desired
 * state, so the delete is skipped rather than treated as an error.
 *
 * @param input - Clerk ids of the pair.
 */
export async function removeMembership(input: {
  clerkOrgId: string;
  clerkUserId: string;
}): Promise<void> {
  const ids = await findOrgUserIds(input);

  if (!ids) {
    return;
  }

  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, ids.orgId), eq(memberships.userId, ids.userId)));
}

export type WebhookClaim = 'new' | 'duplicate';

/**
 * Claims a webhook delivery for processing.
 *
 * A delivery that was already applied is reported as a duplicate. One that was
 * recorded but never finished — the process died mid-apply — is handed back as
 * new so the retry can complete it; the handlers themselves are upserts, so
 * re-applying is harmless.
 *
 * @param input - Provider name, the provider's delivery id, and the validated payload.
 * @returns Whether the caller should process the delivery.
 */
export async function claimWebhookEvent(input: {
  provider: string;
  externalEventId: string;
  payload: Record<string, unknown>;
}): Promise<WebhookClaim> {
  const [existing] = await db
    .select({ processedAt: webhookEvents.processedAt })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, input.provider),
        eq(webhookEvents.externalEventId, input.externalEventId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.processedAt ? 'duplicate' : 'new';
  }

  await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      externalEventId: input.externalEventId,
      payload: input.payload,
    })
    .onConflictDoNothing();

  return 'new';
}

/**
 * Marks a delivery as applied so redeliveries are recognised as duplicates.
 *
 * @param provider - Provider name.
 * @param externalEventId - The provider's delivery id.
 */
export async function markWebhookEventProcessed(
  provider: string,
  externalEventId: string,
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(
      and(eq(webhookEvents.provider, provider), eq(webhookEvents.externalEventId, externalEventId)),
    );
}
