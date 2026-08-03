'use server';

import { revalidatePath } from 'next/cache';
import { CREDIT_RATES } from '@/features/credit/estimate';
import { spendCredits } from '@/features/credit/service';
import { findDefaultProjectId } from '@/features/deck/repository';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import type { WriteBlogInput } from '@/validations/BlogValidation';
import { writeBlogSchema } from '@/validations/BlogValidation';
import { insertBlogPost } from './repository';
import { writeBlogDraft } from './writer';

/**
 * Server Action for drafting a blog post.
 *
 * Runs inline rather than on the queue. A draft is one text completion and
 * comes back in seconds, so putting it through the worker would add a round
 * trip and a status screen to something the user can just wait for.
 *
 * The charge lands before the model call. Charging afterwards would mean a
 * crash mid-generation leaves the work unpaid, and the reverse — refunding what
 * failed — is the case we can actually detect.
 */

export type BlogFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input'
  | 'writer_unavailable';

export type WriteBlogResult =
  | { ok: true; postId: string; title: string }
  | { ok: false; code: BlogFailureCode };

/**
 * Drafts a blog post and stores it.
 *
 * @param input - The topic and an idempotency key for the charge.
 * @returns The stored draft, or a failure code.
 */
export async function writeBlogPost(input: WriteBlogInput): Promise<WriteBlogResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'deck:create');

    if (!Env.ANTHROPIC_API_KEY) {
      return { ok: false, code: 'writer_unavailable' };
    }

    const parsed = writeBlogSchema.parse(input);
    const projectId = await findDefaultProjectId(scope);

    if (!projectId) {
      return { ok: false, code: 'not_found' };
    }

    const chargeKey = `blog:${parsed.idempotencyKey}`;

    await spendCredits(scope, {
      amount: CREDIT_RATES.blogPost,
      reason: 'spend.run',
      idempotencyKey: chargeKey,
    });

    const draft = await writeBlogDraft(parsed.topic);

    const post = await insertBlogPost(scope, {
      projectId,
      title: draft.title,
      topic: parsed.topic,
      body: draft.body,
      status: 'ready',
      creditsCharged: CREDIT_RATES.blogPost,
      chargeKey,
      createdBy: scope.userId,
    });

    logger.info('Blog draft written', { orgId: scope.orgId, postId: post.id });
    revalidatePath('/dashboard/blog');

    return { ok: true, postId: post.id, title: post.title };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Blog draft rejected', { code });

    return { ok: false, code };
  }
}
