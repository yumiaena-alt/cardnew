import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberRole } from '@/models/Org';

type ClerkPair = { clerkOrgId: string; clerkUserId: string };

const repository = vi.hoisted(() => ({
  upsertUser:
    vi.fn<
      (input: { clerkUserId: string; email: string; displayName: string | null }) => Promise<void>
    >(),
  markUserDeletionRequested: vi.fn<(clerkUserId: string) => Promise<void>>(),
  upsertOrganization:
    vi.fn<
      (input: {
        clerkOrgId: string;
        name: string;
        slug: string;
      }) => Promise<{ id: string; planKey: string }>
    >(),
  softDeleteOrganization: vi.fn<(clerkOrgId: string) => Promise<void>>(),
  ensureDefaultProject: vi.fn<(orgId: string) => Promise<void>>(),
  upsertMembership:
    vi.fn<
      (input: { clerkOrgId: string; clerkUserId: string; role: MemberRole }) => Promise<void>
    >(),
  removeMembership: vi.fn<(input: ClerkPair) => Promise<void>>(),
}));

const credit = vi.hoisted(() => ({
  grantSignupCredits: vi.fn<(scope: { orgId: string }, planKey: string) => Promise<null>>(),
}));

vi.mock(import('./repository'), () => repository);
vi.mock(import('@/features/credit/service'), () => credit);

const { applyClerkWebhookEvent } = await import('./service');

const CLERK_ORG_ID = 'org_2abc';
const CLERK_USER_ID = 'user_2xyz';
const INTERNAL_ORG_ID = '0f2c9c1e-6f2a-4c2f-9f2e-8d1a4b6c7e01';

describe(applyClerkWebhookEvent, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.upsertOrganization.mockResolvedValue({ id: INTERNAL_ORG_ID, planKey: 'free' });
    credit.grantSignupCredits.mockResolvedValue(null);
  });

  it('stores the primary email address of a created user', async () => {
    await applyClerkWebhookEvent({
      type: 'user.created',
      data: {
        id: CLERK_USER_ID,
        email_addresses: [
          { id: 'idn_1', email_address: 'old@example.com' },
          { id: 'idn_2', email_address: 'primary@example.com' },
        ],
        primary_email_address_id: 'idn_2',
        first_name: '혜림',
        last_name: '우',
      },
    });

    expect(repository.upsertUser).toHaveBeenCalledWith({
      clerkUserId: CLERK_USER_ID,
      email: 'primary@example.com',
      displayName: '혜림 우',
    });
  });

  it('falls back to the first email address when no primary is marked', async () => {
    await applyClerkWebhookEvent({
      type: 'user.updated',
      data: {
        id: CLERK_USER_ID,
        email_addresses: [{ id: 'idn_1', email_address: 'only@example.com' }],
        primary_email_address_id: null,
        first_name: null,
        last_name: null,
      },
    });

    expect(repository.upsertUser).toHaveBeenCalledWith({
      clerkUserId: CLERK_USER_ID,
      email: 'only@example.com',
      displayName: null,
    });
  });

  it('defers a user with no email address instead of failing the delivery', async () => {
    await applyClerkWebhookEvent({
      type: 'user.created',
      data: {
        id: CLERK_USER_ID,
        email_addresses: [],
        primary_email_address_id: null,
        first_name: null,
        last_name: null,
      },
    });

    expect(repository.upsertUser).not.toHaveBeenCalled();
  });

  it('records a deletion request rather than removing the user', async () => {
    await applyClerkWebhookEvent({ type: 'user.deleted', data: { id: CLERK_USER_ID } });

    expect(repository.markUserDeletionRequested).toHaveBeenCalledWith(CLERK_USER_ID);
  });

  it('creates the default project alongside a new organization', async () => {
    await applyClerkWebhookEvent({
      type: 'organization.created',
      data: { id: CLERK_ORG_ID, name: 'Panelo Studio', slug: 'panelo-studio' },
    });

    expect(repository.upsertOrganization).toHaveBeenCalledWith({
      clerkOrgId: CLERK_ORG_ID,
      name: 'Panelo Studio',
      slug: 'panelo-studio',
    });
    expect(repository.ensureDefaultProject).toHaveBeenCalledWith(INTERNAL_ORG_ID);
  });

  it('grants the plan allowance when an organization is created', async () => {
    await applyClerkWebhookEvent({
      type: 'organization.created',
      data: { id: CLERK_ORG_ID, name: 'Panelo Studio', slug: 'panelo-studio' },
    });

    expect(credit.grantSignupCredits).toHaveBeenCalledWith({ orgId: INTERNAL_ORG_ID }, 'free');
  });

  it('uses the Clerk id as slug when the organization has none', async () => {
    await applyClerkWebhookEvent({
      type: 'organization.created',
      data: { id: CLERK_ORG_ID, name: 'Panelo Studio', slug: null },
    });

    expect(repository.upsertOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ slug: CLERK_ORG_ID }),
    );
  });

  it('soft-deletes a removed organization', async () => {
    await applyClerkWebhookEvent({ type: 'organization.deleted', data: { id: CLERK_ORG_ID } });

    expect(repository.softDeleteOrganization).toHaveBeenCalledWith(CLERK_ORG_ID);
  });

  it('maps the Clerk membership role onto a tenant role', async () => {
    await applyClerkWebhookEvent({
      type: 'organizationMembership.created',
      data: {
        organization: { id: CLERK_ORG_ID },
        public_user_data: { user_id: CLERK_USER_ID },
        role: 'org:admin',
      },
    });

    expect(repository.upsertMembership).toHaveBeenCalledWith({
      clerkOrgId: CLERK_ORG_ID,
      clerkUserId: CLERK_USER_ID,
      role: 'owner',
    });
  });

  it('downgrades an unrecognised membership role to viewer', async () => {
    await applyClerkWebhookEvent({
      type: 'organizationMembership.updated',
      data: {
        organization: { id: CLERK_ORG_ID },
        public_user_data: { user_id: CLERK_USER_ID },
        role: 'org:brand_new',
      },
    });

    expect(repository.upsertMembership).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'viewer' }),
    );
  });

  it('removes a revoked membership', async () => {
    await applyClerkWebhookEvent({
      type: 'organizationMembership.deleted',
      data: {
        organization: { id: CLERK_ORG_ID },
        public_user_data: { user_id: CLERK_USER_ID },
      },
    });

    expect(repository.removeMembership).toHaveBeenCalledWith({
      clerkOrgId: CLERK_ORG_ID,
      clerkUserId: CLERK_USER_ID,
    });
  });
});
