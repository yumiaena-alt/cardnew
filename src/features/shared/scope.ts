import { auth } from '@clerk/nextjs/server';
import { findScopeIdentity } from '@/features/org/repository';
import type { MemberRole } from '@/models/Org';
import { forbiddenError, unauthorizedError } from './errors';
import type { Permission } from './permissions';
import { hasPermission, mapClerkRole } from './permissions';

/**
 * The isolation key on its own.
 *
 * Repositories take this rather than the full `Scope` because filtering only
 * ever needs the organization. It also gives system paths that have no user
 * behind them — the Clerk webhook, scheduled jobs — a way to act on a tenant
 * without inventing a fake session.
 */
export type OrgScope = {
  /** `organizations.id`. The value every tenant query filters on. */
  orgId: string;
};

/**
 * The tenant context every user-facing server entry point resolves before
 * touching data.
 *
 * `orgId` and `userId` are our own primary keys, not Clerk ids: tenant tables
 * carry `organizations.id`, so queries filter on the resolved UUID.
 */
export type Scope = OrgScope & {
  /** `users.id`. */
  userId: string;
  clerkOrgId: string;
  clerkUserId: string;
  role: MemberRole;
  /** Billing plan the organization is on. Drives allowances and gating. */
  planKey: string;
};

/**
 * Resolves the caller's tenant scope from the server-side Clerk session.
 *
 * This is the only place a scope is produced. A client-supplied `orgId` is
 * never read, because a request body can claim any tenant it likes.
 *
 * The membership row is re-checked against our own tables rather than trusted
 * from the session alone, so a Clerk organization that has not been replicated
 * yet — or one whose membership was revoked between webhook deliveries — fails
 * closed.
 *
 * @returns The caller's tenant scope.
 * @throws DomainError `unauthorized` when there is no session, no active organization,
 * or no replicated membership for the pair.
 */
export async function getScope(): Promise<Scope> {
  const { userId, orgId, orgRole } = await auth();

  if (!(userId && orgId)) {
    throw unauthorizedError('No authenticated session with an active organization');
  }

  const identity = await findScopeIdentity({ clerkOrgId: orgId, clerkUserId: userId });

  if (!identity) {
    throw unauthorizedError('Clerk membership has no replicated organization');
  }

  return {
    orgId: identity.orgId,
    userId: identity.userId,
    clerkOrgId: orgId,
    clerkUserId: userId,
    role: mapClerkRole(orgRole),
    planKey: identity.planKey,
  };
}

/**
 * Resolves the tenant scope, or null when it cannot be established.
 *
 * The dashboard shell has to render even for a session whose organization has
 * not been synced yet — a user who just signed up can arrive before the Clerk
 * webhook lands. Throwing there would show an error page for what is really a
 * few seconds of lag, so the shell degrades instead.
 *
 * @returns The tenant scope, or null when there is none to resolve.
 */
export async function findScope(): Promise<Scope | null> {
  const { userId, orgId, orgRole } = await auth();

  if (!(userId && orgId)) {
    return null;
  }

  const identity = await findScopeIdentity({ clerkOrgId: orgId, clerkUserId: userId });

  if (!identity) {
    return null;
  }

  return {
    orgId: identity.orgId,
    userId: identity.userId,
    clerkOrgId: orgId,
    clerkUserId: userId,
    role: mapClerkRole(orgRole),
    planKey: identity.planKey,
  };
}

/**
 * Asserts the scope's role grants a permission.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param permission - Permission the operation requires.
 * @throws DomainError `forbidden` when the role does not grant the permission.
 */
export function requirePermission(scope: Scope, permission: Permission): void {
  if (!hasPermission(scope.role, permission)) {
    throw forbiddenError(`Role ${scope.role} lacks ${permission}`);
  }
}
