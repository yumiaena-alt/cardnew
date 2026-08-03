import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { applySubscription } from '@/features/billing/service';
import { claimWebhookEvent, markWebhookEventProcessed } from '@/features/org/repository';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { getStripe } from '@/libs/Stripe';

/**
 * Stripe webhook.
 *
 * The signature is verified against the raw body before anything is parsed —
 * a webhook that trusts its payload first is a way to grant anyone credits.
 * Events are claimed by their Stripe id so a redelivery, which Stripe does
 * routinely, cannot apply twice.
 */

/**
 * Only subscription events are handled.
 *
 * `checkout.session.completed` carries a Session, not a Subscription, and
 * Stripe fires `customer.subscription.created` for the same purchase anyway —
 * handling both would mean two shapes on one code path for no extra signal.
 */
const HANDLED_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Resolves the organization a subscription belongs to.
 *
 * Read from metadata we set at checkout, never from anything the browser
 * returned, so a tampered redirect cannot attach a payment to another tenant.
 *
 * @param subscription - The Stripe subscription.
 * @returns The organization id, or null when it is missing.
 */
function resolveOrgId(subscription: Stripe.Subscription): string | null {
  return subscription.metadata.orgId ?? null;
}

export async function POST(request: NextRequest) {
  if (!(Env.STRIPE_WEBHOOK_SECRET && Env.STRIPE_SECRET_KEY)) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, Env.STRIPE_WEBHOOK_SECRET);
  } catch {
    logger.warn('Stripe webhook failed signature verification');

    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const claim = await claimWebhookEvent({
    provider: 'stripe',
    externalEventId: event.id,
    payload: { type: event.type },
  });

  if (claim === 'duplicate') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Narrowed by the event type rather than asserted: the guard above admits
  // only subscription events, and this makes the compiler agree.
  if (
    event.type !== 'customer.subscription.created' &&
    event.type !== 'customer.subscription.updated' &&
    event.type !== 'customer.subscription.deleted'
  ) {
    return NextResponse.json({ received: true });
  }

  const subscription = event.data.object;
  const orgId = resolveOrgId(subscription);

  if (!orgId) {
    logger.warn('Stripe subscription has no organization metadata', { eventId: event.id });

    return NextResponse.json({ received: true, skipped: true });
  }

  await applySubscription({ orgId }, subscription);
  await markWebhookEventProcessed('stripe', event.id);

  return NextResponse.json({ received: true });
}
