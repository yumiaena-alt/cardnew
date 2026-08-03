import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleCommentChange } from '@/features/social/service';
import { matchesVerifyToken, verifyMetaSignature } from '@/features/social/signature';
import { logger } from '@/libs/Logger';
import { commentChangeSchema, metaWebhookSchema } from '@/validations/MetaWebhookValidation';

/**
 * Instagram webhook — comments in, private replies out.
 *
 * The signature is checked against the raw body before anything is parsed. This
 * endpoint decides who receives a message in our users' names, so a delivery
 * that cannot prove where it came from is not read at all.
 *
 * Everything past the signature answers 200. The network retries anything else,
 * and a retry of a comment we already answered is only harmless because the
 * send is claimed by comment id — but a retry storm caused by our own parse
 * error would be noise on top of a problem we already logged.
 */

/** Only this field is acted on. Anything else the subscription sends is dropped. */
const COMMENTS_FIELD = 'comments';

/**
 * Decodes the body without letting a malformed one become a 500.
 *
 * @param raw - The verified request body.
 * @returns The decoded value, or null when it is not JSON.
 */
function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Subscription handshake. Meta calls this once when the webhook is registered.
 *
 * @param request - The handshake request, carrying the challenge to echo.
 * @returns The challenge when the token matches, and a refusal otherwise.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (
    params.get('hub.mode') === 'subscribe' &&
    matchesVerifyToken(params.get('hub.verify_token'))
  ) {
    return new NextResponse(params.get('hub.challenge') ?? '', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }

  logger.warn('Instagram webhook handshake refused');

  return NextResponse.json({ error: 'invalid_verify_token' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) {
    logger.warn('Instagram webhook failed signature verification');

    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  const parsed = metaWebhookSchema.safeParse(readJson(raw));

  if (!parsed.success) {
    logger.warn('Instagram webhook payload not understood');

    return NextResponse.json({ received: true, skipped: true });
  }

  if (parsed.data.object !== 'instagram') {
    return NextResponse.json({ received: true, skipped: true });
  }

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== COMMENTS_FIELD) {
        continue;
      }

      const comment = commentChangeSchema.safeParse(change.value);

      if (!comment.success) {
        continue;
      }

      const outcome = await handleCommentChange({
        accountExternalId: entry.id,
        comment: comment.data,
      });

      logger.info('Comment handled', { outcome });
    }
  }

  return NextResponse.json({ received: true });
}
