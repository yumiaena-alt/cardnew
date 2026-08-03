import Stripe from 'stripe';
import { Env } from './Env';

/**
 * Stripe client.
 *
 * Constructed lazily rather than at module load so the app boots in an
 * environment with no Stripe key — local development and CI both run without
 * one, and a top-level throw would take down every route, not just billing.
 */

let client: Stripe | null = null;

/**
 * Returns the Stripe client, creating it on first use.
 *
 * @returns The configured client.
 * @throws Error when Stripe is not configured in this environment.
 */
export function getStripe(): Stripe {
  if (!Env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  client ??= new Stripe(Env.STRIPE_SECRET_KEY);

  return client;
}

/**
 * Whether checkout can be offered at all.
 *
 * @returns True when both the secret key and the Standard price are present.
 */
export function isBillingConfigured(): boolean {
  return Boolean(Env.STRIPE_SECRET_KEY && Env.STRIPE_STANDARD_PRICE_ID);
}
