import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { claimWebhookEvent, markWebhookEventProcessed } from '@/features/org/repository';
import { applyClerkWebhookEvent } from '@/features/org/service';
import { isDomainError } from '@/features/shared/errors';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { ClerkWebhookValidation, isHandledClerkEvent } from '@/validations/ClerkWebhookValidation';

const PROVIDER = 'clerk';
const SVIX_ID_HEADER = 'svix-id';

/**
 * Clerk webhook receiver.
 *
 * The route sits outside the proxy matcher, so Arcjet's bot detection never
 * sees it — the Svix signature is the access control, and nothing in the body
 * is read before it verifies.
 *
 * @param request - The incoming Clerk delivery.
 * @returns 200 once the delivery is applied, ignored, or recognised as a
 * redelivery; 400 on a bad signature; 422 on an unexpected payload shape; 409
 * when the delivery depends on a record Clerk has not sent yet.
 */
export const POST = async (request: NextRequest) => {
  if (!Env.CLERK_WEBHOOK_SECRET) {
    logger.error('Clerk webhook received while CLERK_WEBHOOK_SECRET is unset');

    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });
  }

  const deliveryId = request.headers.get(SVIX_ID_HEADER);

  if (!deliveryId) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const event = await verifyWebhook(request, {
    signingSecret: Env.CLERK_WEBHOOK_SECRET,
  }).catch(() => null);

  if (!event) {
    // The body is attacker-controlled until the signature verifies, so only the
    // fact of the failure is logged.
    logger.warn(`Clerk webhook ${deliveryId} failed signature verification`);

    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (!isHandledClerkEvent(event.type)) {
    return NextResponse.json({ status: 'ignored' });
  }

  const parsed = ClerkWebhookValidation.safeParse(event);

  if (!parsed.success) {
    logger.error(`Clerk webhook ${event.type} failed schema validation`);

    return NextResponse.json({ error: 'invalid_payload' }, { status: 422 });
  }

  const claim = await claimWebhookEvent({
    provider: PROVIDER,
    externalEventId: deliveryId,
    payload: parsed.data,
  });

  if (claim === 'duplicate') {
    return NextResponse.json({ status: 'duplicate' });
  }

  try {
    await applyClerkWebhookEvent(parsed.data);
  } catch (error) {
    if (!isDomainError(error, 'conflict')) {
      throw error;
    }

    // Clerk does not order deliveries. Leaving the claim unprocessed lets the
    // retry apply it once the record it depends on has arrived.
    logger.warn(`Clerk webhook ${event.type} arrived out of order, awaiting retry`);

    return NextResponse.json({ error: 'out_of_order' }, { status: 409 });
  }

  await markWebhookEventProcessed(PROVIDER, deliveryId);

  logger.info(`Clerk webhook ${event.type} applied`);

  return NextResponse.json({ status: 'applied' });
};
