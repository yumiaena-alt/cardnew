import { describe, expect, it } from 'vitest';
import { ClerkWebhookValidation, isHandledClerkEvent } from './ClerkWebhookValidation';

const CLERK_ORG_ID = 'org_2abc';
const CLERK_USER_ID = 'user_2xyz';

describe('Clerk webhook payload schema', () => {
  it('accepts a user event and drops fields we do not persist', () => {
    const parsed = ClerkWebhookValidation.parse({
      type: 'user.created',
      data: {
        id: CLERK_USER_ID,
        email_addresses: [{ id: 'idn_1', email_address: 'owner@example.com' }],
        primary_email_address_id: 'idn_1',
        first_name: '혜림',
        last_name: '우',
        private_metadata: { internal: 'secret' },
      },
    });

    expect(parsed.type).toBe('user.created');
    expect(parsed.data).not.toHaveProperty('private_metadata');
  });

  it('defaults a user event with no email addresses to an empty list', () => {
    const parsed = ClerkWebhookValidation.parse({
      type: 'user.updated',
      data: { id: CLERK_USER_ID },
    });

    expect(parsed).toMatchObject({ data: { email_addresses: [] } });
  });

  it('rejects a malformed email address', () => {
    const result = ClerkWebhookValidation.safeParse({
      type: 'user.created',
      data: {
        id: CLERK_USER_ID,
        email_addresses: [{ id: 'idn_1', email_address: 'not-an-email' }],
      },
    });

    expect(result.success).toBeFalsy();
  });

  it('accepts an organization event without a slug', () => {
    const parsed = ClerkWebhookValidation.parse({
      type: 'organization.created',
      data: { id: CLERK_ORG_ID, name: 'Panelo Studio', slug: null },
    });

    expect(parsed).toMatchObject({ data: { slug: null } });
  });

  it('rejects a membership event missing the user reference', () => {
    const result = ClerkWebhookValidation.safeParse({
      type: 'organizationMembership.created',
      data: { organization: { id: CLERK_ORG_ID }, role: 'org:admin' },
    });

    expect(result.success).toBeFalsy();
  });

  it('rejects an event type it does not model', () => {
    const result = ClerkWebhookValidation.safeParse({
      type: 'session.created',
      data: { id: 'sess_1' },
    });

    expect(result.success).toBeFalsy();
  });
});

describe(isHandledClerkEvent, () => {
  it('recognises the replicated event types', () => {
    expect(isHandledClerkEvent('organizationMembership.deleted')).toBeTruthy();
    expect(isHandledClerkEvent('user.created')).toBeTruthy();
  });

  it('rejects an event type the sync ignores', () => {
    expect(isHandledClerkEvent('session.created')).toBeFalsy();
    expect(isHandledClerkEvent('')).toBeFalsy();
  });
});
