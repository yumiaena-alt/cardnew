import type Stripe from 'stripe';
import { grantCredits } from '@/features/credit/service';
import { conflictError } from '@/features/shared/errors';
import type { OrgScope, Scope } from '@/features/shared/scope';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { getStripe, isBillingConfigured } from '@/libs/Stripe';
import { findPlanLimit, upsertSubscription } from './repository';

/**
 * Subscription billing.
 *
 * The organization id travels on the Checkout session as client reference and
 * on the customer as metadata, so a webhook can always resolve which tenant a
 * payment belongs to without trusting anything the browser sent back.
 */

const STANDARD_PLAN_KEY = 'standard';

/**
 * Starts a Checkout session for the Standard plan.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param urls - Where Stripe returns the user on success or cancel.
 * @returns The URL to send the browser to.
 * @throws DomainError `conflict` when billing is not configured.
 */
export async function createCheckoutSession(
  scope: Scope,
  urls: { successUrl: string; cancelUrl: string },
): Promise<string> {
  if (!(isBillingConfigured() && Env.STRIPE_STANDARD_PRICE_ID)) {
    throw conflictError('Stripe billing is not configured');
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: Env.STRIPE_STANDARD_PRICE_ID, quantity: 1 }],
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    // Resolved back on the webhook. Never read from the redirect, which the
    // user controls.
    client_reference_id: scope.orgId,
    subscription_data: { metadata: { orgId: scope.orgId } },
  });

  if (!session.url) {
    throw conflictError('Stripe returned no checkout URL');
  }

  logger.info('Checkout session created', { orgId: scope.orgId, sessionId: session.id });

  return session.url;
}

/**
 * Records a completed checkout and grants the plan's allowance.
 *
 * The grant is keyed by the subscription and period, so Stripe redelivering the
 * event — which it does routinely — cannot hand out the allowance twice.
 *
 * @param scope - The organization the subscription belongs to.
 * @param subscription - The Stripe subscription.
 */
export async function applySubscription(
  scope: OrgScope,
  subscription: Stripe.Subscription,
): Promise<void> {
  const [item] = subscription.items.data;
  const periodStart = item?.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? null;

  await upsertSubscription(scope, {
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    planKey: STANDARD_PLAN_KEY,
    status: subscription.status,
    currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  if (subscription.status !== 'active') {
    return;
  }

  const plan = await findPlanLimit(STANDARD_PLAN_KEY);

  if (!plan || plan.monthlyCredits <= 0) {
    return;
  }

  await grantCredits(scope, {
    amount: plan.monthlyCredits,
    reason: 'grant.purchase',
    idempotencyKey: `subscription:${subscription.id}:${periodStart ?? 0}`,
    expiresAt: periodEnd ? new Date(periodEnd * 1000) : undefined,
    ref: { type: 'subscription', id: subscription.id },
  });

  logger.info('Subscription allowance granted', {
    orgId: scope.orgId,
    subscriptionId: subscription.id,
    credits: plan.monthlyCredits,
  });
}
