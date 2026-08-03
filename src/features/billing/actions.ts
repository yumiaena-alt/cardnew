'use server';

import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { createCheckoutSession } from './service';

/**
 * Server Action for starting a subscription.
 *
 * The return URLs are built from the configured app origin, never from the
 * request. A redirect target taken from the client is an open redirect, and
 * this one is handed to a payment provider.
 */

export type CheckoutResult = { ok: true; url: string } | { ok: false; code: string };

/**
 * Creates a Checkout session for the Standard plan.
 *
 * @returns The Stripe-hosted URL, or a failure code.
 */
export async function startStandardCheckout(): Promise<CheckoutResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'billing:manage');

    const origin = Env.NEXT_PUBLIC_APP_URL ?? '';

    const url = await createCheckoutSession(scope, {
      successUrl: `${origin}/dashboard?checkout=done`,
      cancelUrl: `${origin}/dashboard?checkout=canceled`,
    });

    return { ok: true, url };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Checkout rejected', { code });

    return { ok: false, code };
  }
}
