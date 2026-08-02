import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScopeIdentity } from '@/features/org/repository';
import { DomainError } from './errors';

type ClerkSession = {
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
};

type FindScopeIdentity = (input: {
  clerkOrgId: string;
  clerkUserId: string;
}) => Promise<ScopeIdentity | null>;

const auth = vi.hoisted(() => vi.fn<() => Promise<ClerkSession>>());
const findScopeIdentity = vi.hoisted(() => vi.fn<FindScopeIdentity>());

// Clerk's `auth` is a callable carrying its own helper properties, which a stub
// cannot satisfy structurally, so this mock stays on the string form.
// oxlint-disable-next-line vitest/prefer-import-in-mock
vi.mock('@clerk/nextjs/server', () => ({ auth }));
vi.mock(import('@/features/org/repository'), () => ({ findScopeIdentity }));

const { getScope, requirePermission } = await import('./scope');

const CLERK_ORG_ID = 'org_2abc';
const CLERK_USER_ID = 'user_2xyz';
const INTERNAL_ORG_ID = '0f2c9c1e-6f2a-4c2f-9f2e-8d1a4b6c7e01';
const INTERNAL_USER_ID = '3a7b5d90-1c44-4b6e-9a02-77d5c3f1b208';

const ADMIN_SESSION: ClerkSession = {
  userId: CLERK_USER_ID,
  orgId: CLERK_ORG_ID,
  orgRole: 'org:admin',
};

describe(getScope, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findScopeIdentity.mockResolvedValue({
      orgId: INTERNAL_ORG_ID,
      userId: INTERNAL_USER_ID,
      planKey: 'free',
    });
  });

  it('resolves internal ids for an active organization session', async () => {
    auth.mockResolvedValue(ADMIN_SESSION);

    const scope = await getScope();

    expect(scope).toStrictEqual({
      orgId: INTERNAL_ORG_ID,
      userId: INTERNAL_USER_ID,
      clerkOrgId: CLERK_ORG_ID,
      clerkUserId: CLERK_USER_ID,
      role: 'owner',
      planKey: 'free',
    });
  });

  it('looks the tenant up by the session ids and nothing else', async () => {
    auth.mockResolvedValue(ADMIN_SESSION);

    await getScope();

    expect(findScopeIdentity).toHaveBeenCalledWith({
      clerkOrgId: CLERK_ORG_ID,
      clerkUserId: CLERK_USER_ID,
    });
  });

  it('rejects a session without a user', async () => {
    auth.mockResolvedValue({ ...ADMIN_SESSION, userId: null });

    await expect(getScope()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects a session without an active organization', async () => {
    auth.mockResolvedValue({ userId: CLERK_USER_ID, orgId: null, orgRole: null });

    await expect(getScope()).rejects.toMatchObject({ code: 'unauthorized' });
    expect(findScopeIdentity).not.toHaveBeenCalled();
  });

  it('rejects a membership that has no replicated organization', async () => {
    auth.mockResolvedValue(ADMIN_SESSION);
    findScopeIdentity.mockResolvedValue(null);

    await expect(getScope()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('downgrades an unrecognised Clerk role to viewer', async () => {
    auth.mockResolvedValue({ ...ADMIN_SESSION, orgRole: 'org:unknown' });

    const scope = await getScope();

    expect(scope.role).toBe('viewer');
  });
});

describe(requirePermission, () => {
  const scope = {
    orgId: INTERNAL_ORG_ID,
    userId: INTERNAL_USER_ID,
    clerkOrgId: CLERK_ORG_ID,
    clerkUserId: CLERK_USER_ID,
    role: 'editor',
    planKey: 'free',
  } as const;

  it('passes when the role grants the permission', () => {
    expect(() => {
      requirePermission(scope, 'run:execute');
    }).not.toThrow();
  });

  it('throws when the role lacks the permission', () => {
    expect(() => {
      requirePermission(scope, 'member:manage');
    }).toThrow(DomainError);
  });
});
