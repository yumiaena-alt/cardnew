import { grantSignupCredits } from '@/features/credit/service';
import { mapClerkRole } from '@/features/shared/permissions';
import { logger } from '@/libs/Logger';
import type {
  ClerkOrganizationData,
  ClerkUserData,
  ClerkWebhookEvent,
} from '@/validations/ClerkWebhookValidation';
import {
  ensureDefaultProject,
  markUserDeletionRequested,
  removeMembership,
  softDeleteOrganization,
  upsertMembership,
  upsertOrganization,
  upsertUser,
} from './repository';

function resolveEmail(data: ClerkUserData): string | null {
  const primary = data.email_addresses.find((entry) => entry.id === data.primary_email_address_id);

  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? null;
}

function resolveDisplayName(data: ClerkUserData): string | null {
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();

  return name.length > 0 ? name : null;
}

async function syncUser(data: ClerkUserData): Promise<void> {
  const email = resolveEmail(data);

  if (!email) {
    // `users.email` is NOT NULL and a phone-only Clerk account has none. Failing
    // here would put the delivery into a permanent retry loop, so the sync is
    // deferred: the `user.updated` that adds an address will carry it.
    logger.warn(`Clerk user ${data.id} has no email address, skipping sync`);

    return;
  }

  await upsertUser({
    clerkUserId: data.id,
    email,
    displayName: resolveDisplayName(data),
  });
}

async function syncOrganization(data: ClerkOrganizationData): Promise<void> {
  const organization = await upsertOrganization({
    clerkOrgId: data.id,
    name: data.name,
    // Clerk allows an organization without a slug. The Clerk id is already
    // unique and stable, so it stands in rather than leaving the column empty.
    slug: data.slug ?? data.id,
  });

  await ensureDefaultProject(organization.id);

  // Keyed off the organization id, so an `organization.updated` replay or a
  // redelivered `organization.created` never grants a second allowance.
  await grantSignupCredits({ orgId: organization.id }, organization.planKey);
}

/**
 * Applies a verified Clerk webhook event to the tenant replica.
 *
 * Every branch is an upsert or a soft delete, so replaying an event converges
 * on the same state instead of duplicating rows.
 *
 * @param event - A signature-verified, schema-validated Clerk event.
 * @throws DomainError `conflict` when a membership event arrives before the
 * records it references, which the caller reports as retryable.
 */
export async function applyClerkWebhookEvent(event: ClerkWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      await syncUser(event.data);
      break;
    }

    case 'user.deleted': {
      await markUserDeletionRequested(event.data.id);
      break;
    }

    case 'organization.created':
    case 'organization.updated': {
      await syncOrganization(event.data);
      break;
    }

    case 'organization.deleted': {
      await softDeleteOrganization(event.data.id);
      break;
    }

    case 'organizationMembership.created':
    case 'organizationMembership.updated': {
      await upsertMembership({
        clerkOrgId: event.data.organization.id,
        clerkUserId: event.data.public_user_data.user_id,
        role: mapClerkRole(event.data.role),
      });
      break;
    }

    case 'organizationMembership.deleted': {
      await removeMembership({
        clerkOrgId: event.data.organization.id,
        clerkUserId: event.data.public_user_data.user_id,
      });
      break;
    }

    default: {
      break;
    }
  }
}
