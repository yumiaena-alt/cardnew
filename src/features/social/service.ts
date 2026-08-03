import { decryptSecret } from '@/libs/Crypto';
import { logger } from '@/libs/Logger';
import type { DmAutomation } from '@/models/Social';
import type { CommentChange } from '@/validations/MetaWebhookValidation';
import { findTriggerKeyword } from './matching';
import { composeReply, sendPrivateReply } from './reply';
import {
  claimDmSend,
  findAccountByExternalId,
  listActiveAutomations,
  settleDmSend,
} from './repository';

/**
 * Turning a comment into a private reply.
 *
 * Every step that can decline says so by name rather than by throwing. A
 * webhook has to be answered with a 200 whatever happens — the network retries
 * anything else — so the caller needs to tell "we chose not to reply" apart
 * from "we tried and could not", and only the second is worth an alert.
 */

export type CommentOutcome =
  | 'sent'
  | 'failed'
  | 'duplicate'
  | 'no_match'
  | 'no_account'
  | 'own_comment';

/**
 * Picks the automation that answers a comment.
 *
 * A rule bound to one post only looks at that post. The first match wins, so
 * the order the rules were written in is the order they are tried.
 *
 * @param automations - The account's active automations.
 * @param comment - The comment that arrived.
 * @returns The automation to run, or null when none applies.
 */
function selectAutomation(
  automations: readonly DmAutomation[],
  comment: CommentChange,
): DmAutomation | null {
  for (const automation of automations) {
    const watchesThisPost =
      automation.externalPostId === null || automation.externalPostId === comment.media?.id;

    if (watchesThisPost && findTriggerKeyword(comment.text, automation.keywords)) {
      return automation;
    }
  }

  return null;
}

/**
 * Answers one comment, when a rule says to.
 *
 * @param input - The account the comment landed on, and the comment itself.
 * @returns What happened, including the reasons for not replying.
 */
export async function handleCommentChange(input: {
  accountExternalId: string;
  comment: CommentChange;
}): Promise<CommentOutcome> {
  // The owner's own replies come back through the same webhook. Answering them
  // would have an automation talking to itself.
  if (input.comment.from?.id === input.accountExternalId) {
    return 'own_comment';
  }

  const account = await findAccountByExternalId('instagram', input.accountExternalId);

  if (!(account?.isActive && account.accessTokenCipher)) {
    return 'no_account';
  }

  const scope = { orgId: account.orgId };
  const automation = selectAutomation(
    await listActiveAutomations(scope, account.id),
    input.comment,
  );

  if (!automation) {
    return 'no_match';
  }

  const claim = await claimDmSend(scope, {
    automationId: automation.id,
    externalCommentId: input.comment.id,
  });

  if (!claim) {
    return 'duplicate';
  }

  const result = await sendPrivateReply({
    accountExternalId: account.externalId,
    commentId: input.comment.id,
    message: composeReply(automation.message, automation.linkUrl),
    accessToken: decryptSecret(account.accessTokenCipher),
  });

  if (result.ok) {
    await settleDmSend(scope, claim.id, { status: 'sent' });
    logger.info('Automation replied', { orgId: scope.orgId, automationId: automation.id });

    return 'sent';
  }

  await settleDmSend(scope, claim.id, { status: 'failed', errorMessage: result.error });
  logger.warn('Automation reply failed', { orgId: scope.orgId, automationId: automation.id });

  return 'failed';
}
