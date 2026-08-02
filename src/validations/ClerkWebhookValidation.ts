import * as z from 'zod';

/**
 * Zod schemas for the Clerk webhook events we replicate into `cardnews`.
 *
 * Clerk ships types for these payloads, but the body still crosses a system
 * boundary, so it is parsed rather than trusted. Only the fields we persist are
 * declared; anything else Clerk adds is dropped instead of stored.
 */

const clerkEmailAddressSchema = z.object({
  id: z.string().min(1),
  email_address: z.email(),
});

const clerkUserDataSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(clerkEmailAddressSchema).default([]),
  primary_email_address_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
});

const clerkOrganizationDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).nullish(),
});

const clerkMembershipDataSchema = z.object({
  organization: z.object({ id: z.string().min(1) }),
  public_user_data: z.object({ user_id: z.string().min(1) }),
});

export const ClerkWebhookValidation = z.discriminatedUnion('type', [
  z.object({
    type: z.enum(['user.created', 'user.updated']),
    data: clerkUserDataSchema,
  }),
  z.object({
    type: z.literal('user.deleted'),
    data: z.object({ id: z.string().min(1) }),
  }),
  z.object({
    type: z.enum(['organization.created', 'organization.updated']),
    data: clerkOrganizationDataSchema,
  }),
  z.object({
    type: z.literal('organization.deleted'),
    data: z.object({ id: z.string().min(1) }),
  }),
  z.object({
    type: z.enum(['organizationMembership.created', 'organizationMembership.updated']),
    data: clerkMembershipDataSchema.extend({ role: z.string().min(1) }),
  }),
  z.object({
    type: z.literal('organizationMembership.deleted'),
    data: clerkMembershipDataSchema,
  }),
]);

export type ClerkWebhookEvent = z.infer<typeof ClerkWebhookValidation>;
export type ClerkUserData = z.infer<typeof clerkUserDataSchema>;
export type ClerkOrganizationData = z.infer<typeof clerkOrganizationDataSchema>;

const HANDLED_EVENT_TYPES = new Set<string>([
  'user.created',
  'user.updated',
  'user.deleted',
  'organization.created',
  'organization.updated',
  'organization.deleted',
  'organizationMembership.created',
  'organizationMembership.updated',
  'organizationMembership.deleted',
]);

/**
 * Reports whether an event type is one we replicate.
 *
 * A Clerk instance emits far more event types than we subscribe to. Recognising
 * the unhandled ones lets the route acknowledge them with 200 instead of
 * failing validation and sending Clerk into a retry loop.
 *
 * @param type - The `type` field of a verified webhook event.
 * @returns True when the event should be applied.
 */
export function isHandledClerkEvent(type: string): boolean {
  return HANDLED_EVENT_TYPES.has(type);
}
