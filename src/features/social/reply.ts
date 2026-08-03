import { logger } from '@/libs/Logger';
import { GRAPH_BASE, GRAPH_TIMEOUT_MS, readGraphError } from './graph';

/**
 * Answering a commenter privately.
 *
 * This is the reply-to-a-comment flow the network supports: the recipient is a
 * comment id, not a person. There is no way to address someone who has not
 * commented on the owner's own post, which is what keeps the feature on the
 * right side of the platform's messaging rules.
 */

export type ReplyResult = { ok: true } | { ok: false; error: string };

/**
 * Builds the message body, appending the link when the automation carries one.
 *
 * @param message - The automation's message.
 * @param linkUrl - An optional link to append.
 * @returns The text to send.
 */
export function composeReply(message: string, linkUrl: string | null): string {
  return linkUrl ? `${message}\n\n${linkUrl}` : message;
}

/**
 * Sends a private reply to a comment.
 *
 * The provider only accepts this within about a week of the comment, so a
 * refusal here is often an old comment rather than a broken connection. The
 * message it returns is kept verbatim for that reason.
 *
 * @param input - The account, the comment, the text, and the account's token.
 * @returns Success, or the provider's reason for refusing.
 */
export async function sendPrivateReply(input: {
  accountExternalId: string;
  commentId: string;
  message: string;
  accessToken: string;
}): Promise<ReplyResult> {
  const response = await fetch(`${GRAPH_BASE}/${input.accountExternalId}/messages`, {
    method: 'POST',
    headers: {
      // In the header rather than the query string: a token in a URL ends up in
      // proxy logs and error reports.
      Authorization: `Bearer ${input.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { comment_id: input.commentId },
      message: { text: input.message },
    }),
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  }).catch(() => null);

  if (!response) {
    return { ok: false, error: 'network_error' };
  }

  if (!response.ok) {
    const error = readGraphError(await response.json().catch(() => null));

    logger.warn('Private reply refused', { status: response.status });

    return { ok: false, error };
  }

  return { ok: true };
}
