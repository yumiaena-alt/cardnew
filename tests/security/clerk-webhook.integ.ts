import { createHmac } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';

const WEBHOOK_PATH = '/api/webhooks/clerk';
const SECRET_PREFIX = 'whsec_';
/** Matches the throwaway secret handed to the test server in `playwright.config.ts`. */
const SIGNING_SECRET = 'whsec_cGFuZWxvLWUyZS13ZWJob29rLXNpZ25pbmcta2V5ISE=';

const JSON_HEADERS = { 'content-type': 'application/json' };

function signedHeaders(deliveryId: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = Buffer.from(SIGNING_SECRET.slice(SECRET_PREFIX.length), 'base64');
  const signature = createHmac('sha256', key)
    .update(`${deliveryId}.${timestamp}.${body}`)
    .digest('base64');

  return {
    ...JSON_HEADERS,
    'svix-id': deliveryId,
    'svix-timestamp': timestamp.toString(),
    'svix-signature': `v1,${signature}`,
  };
}

function organizationCreatedBody(clerkOrgId: string) {
  return JSON.stringify({
    type: 'organization.created',
    data: {
      id: clerkOrgId,
      name: 'Panelo integration org',
      slug: clerkOrgId.replace('org_', 'panelo-'),
    },
  });
}

test.describe('Clerk webhook', () => {
  test.describe('Signature enforcement', () => {
    test('rejects a delivery with no signature headers', async ({ page }) => {
      const response = await page.request.post(WEBHOOK_PATH, {
        headers: JSON_HEADERS,
        data: organizationCreatedBody('org_unsigned'),
      });

      expect(response.status()).toBe(400);
    });

    test('rejects a delivery whose signature does not match the body', async ({ page }) => {
      const deliveryId = `msg_${faker.string.alphanumeric(24)}`;
      const headers = signedHeaders(deliveryId, organizationCreatedBody('org_signed'));

      const response = await page.request.post(WEBHOOK_PATH, {
        headers,
        data: organizationCreatedBody('org_tampered'),
      });

      expect(response.status()).toBe(400);
    });

    test('rejects a delivery signed with the wrong key', async ({ page }) => {
      const deliveryId = `msg_${faker.string.alphanumeric(24)}`;
      const body = organizationCreatedBody('org_wrong_key');
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', Buffer.from('not-the-signing-key'))
        .update(`${deliveryId}.${timestamp}.${body}`)
        .digest('base64');

      const response = await page.request.post(WEBHOOK_PATH, {
        headers: {
          ...JSON_HEADERS,
          'svix-id': deliveryId,
          'svix-timestamp': timestamp.toString(),
          'svix-signature': `v1,${signature}`,
        },
        data: body,
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Delivery handling', () => {
    test('acknowledges an event type the sync does not handle', async ({ page }) => {
      const deliveryId = `msg_${faker.string.alphanumeric(24)}`;
      const body = JSON.stringify({ type: 'session.created', data: { id: 'sess_1' } });

      const response = await page.request.post(WEBHOOK_PATH, {
        headers: signedHeaders(deliveryId, body),
        data: body,
      });

      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: 'ignored' });
    });

    test('applies an organization event and skips its redelivery', async ({ page }) => {
      const clerkOrgId = `org_${faker.string.alphanumeric(24)}`;
      const deliveryId = `msg_${faker.string.alphanumeric(24)}`;
      const body = organizationCreatedBody(clerkOrgId);

      const applied = await page.request.post(WEBHOOK_PATH, {
        headers: signedHeaders(deliveryId, body),
        data: body,
      });

      expect(applied.status()).toBe(200);
      await expect(applied.json()).resolves.toEqual({ status: 'applied' });

      const redelivered = await page.request.post(WEBHOOK_PATH, {
        headers: signedHeaders(deliveryId, body),
        data: body,
      });

      expect(redelivered.status()).toBe(200);
      await expect(redelivered.json()).resolves.toEqual({ status: 'duplicate' });
    });

    test('re-applies the same organization under a new delivery id', async ({ page }) => {
      const clerkOrgId = `org_${faker.string.alphanumeric(24)}`;
      const body = organizationCreatedBody(clerkOrgId);

      const first = await page.request.post(WEBHOOK_PATH, {
        headers: signedHeaders(`msg_${faker.string.alphanumeric(24)}`, body),
        data: body,
      });
      const second = await page.request.post(WEBHOOK_PATH, {
        headers: signedHeaders(`msg_${faker.string.alphanumeric(24)}`, body),
        data: body,
      });

      // The upsert plus the partial unique index on the default project make a
      // repeat delivery converge instead of duplicating tenant rows.
      await expect(first.json()).resolves.toEqual({ status: 'applied' });
      await expect(second.json()).resolves.toEqual({ status: 'applied' });
    });

    test('defers a membership that arrives before its organization', async ({ page }) => {
      const deliveryId = `msg_${faker.string.alphanumeric(24)}`;
      const body = JSON.stringify({
        type: 'organizationMembership.created',
        data: {
          organization: { id: `org_${faker.string.alphanumeric(24)}` },
          public_user_data: { user_id: `user_${faker.string.alphanumeric(24)}` },
          role: 'org:admin',
        },
      });

      const response = await page.request.post(WEBHOOK_PATH, {
        headers: signedHeaders(deliveryId, body),
        data: body,
      });

      expect(response.status()).toBe(409);
    });
  });
});
