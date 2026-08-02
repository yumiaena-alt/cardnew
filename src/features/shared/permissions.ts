import type { MemberRole } from '@/models/Org';

/**
 * Permission catalogue. Every guarded server entry point names one of these
 * literals, so a typo is a type error rather than a silent authorization hole.
 */
export const PERMISSION_KEYS = [
  'deck:create',
  'deck:read',
  'deck:update',
  'deck:delete',
  'deck:comment',
  'board:read',
  'board:edit',
  'template:create',
  'template:read',
  'template:update',
  'template:delete',
  'run:execute',
  'member:manage',
  'billing:read',
  'billing:manage',
  'analytics:read',
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

/**
 * Grants per role. A grant is either the catch-all `*`, a namespace wildcard
 * such as `deck:*`, or an exact permission.
 *
 * Phase 1~3 only ever creates `owner` members, but every role is defined up
 * front so enabling a role later is a UI change and not an authorization
 * rewrite.
 */
const PERMISSIONS = {
  owner: ['*'],
  admin: ['deck:*', 'board:*', 'template:*', 'member:manage', 'billing:read'],
  editor: ['deck:create', 'deck:update', 'board:edit', 'run:execute', 'analytics:read'],
  reviewer: ['deck:read', 'deck:comment', 'analytics:read'],
  viewer: ['deck:read', 'analytics:read'],
} as const satisfies Record<MemberRole, readonly string[]>;

const WILDCARD_SUFFIX = ':*';

function matchesGrant(grant: string, permission: Permission): boolean {
  if (grant === '*' || grant === permission) {
    return true;
  }

  if (!grant.endsWith(WILDCARD_SUFFIX)) {
    return false;
  }

  const namespace = grant.slice(0, -1);

  return permission.startsWith(namespace);
}

/**
 * Checks whether a role grants a permission.
 *
 * @param role - Tenant role of the caller.
 * @param permission - Permission the operation requires.
 * @returns True when the role grants the permission.
 */
export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return PERMISSIONS[role].some((grant) => matchesGrant(grant, permission));
}

/**
 * Clerk organization roles mapped onto our own. Clerk's built-in instance roles
 * are `org:admin` and `org:member`; the rest are custom roles named
 * one-to-one after ours.
 */
const CLERK_ROLE_MAP: Record<string, MemberRole> = {
  'org:admin': 'owner',
  'org:owner': 'owner',
  'org:editor': 'editor',
  'org:reviewer': 'reviewer',
  'org:viewer': 'viewer',
  'org:member': 'editor',
};

/**
 * Maps a Clerk organization role onto a tenant role. An unknown or missing role
 * falls back to `viewer` so a Clerk-side role rename can only ever reduce
 * access, never widen it.
 *
 * @param clerkRole - Role string from the Clerk session or webhook payload.
 * @returns The matching tenant role.
 */
export function mapClerkRole(clerkRole: string | null | undefined): MemberRole {
  if (!clerkRole) {
    return 'viewer';
  }

  return CLERK_ROLE_MAP[clerkRole] ?? 'viewer';
}
