'use server';

import { revalidatePath } from 'next/cache';
import { CREDIT_RATES } from '@/features/credit/estimate';
import { getBalance, spendCredits } from '@/features/credit/service';
import { checkMargin } from '@/features/run/providerCost';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type { LearnDesignInput } from '@/validations/TemplateValidation';
import { learnDesignSchema } from '@/validations/TemplateValidation';
import { learnDesign } from './learn';
import { saveLearnedTemplate } from './repository';

/**
 * Server Actions for learning a design from reference images.
 *
 * Learning spends credits, so it goes through the same shape as generation: a
 * quote first, then a charge, and nothing in between that could take money
 * without the user having seen the price.
 */

export type LearnFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input'
  | 'rights_not_confirmed'
  | 'planner_unavailable';

export type LearnQuote = { credits: number; balance: number; affordable: boolean };

export type LearnResult =
  | { ok: true; dryRun: true; quote: LearnQuote }
  | { ok: true; dryRun: false; templateId: string; quote: LearnQuote }
  | { ok: false; code: LearnFailureCode };

/**
 * Quotes or runs a design learning pass.
 *
 * The quote is not an estimate that might move: learning is one call at one
 * price regardless of how many references are supplied, so what the dry run
 * says is what the charge will be.
 *
 * @param input - References, ratio, instruction, and whether this is a quote.
 * @returns The quote, or the template that was produced.
 */
export async function runDesignLearning(input: LearnDesignInput): Promise<LearnResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'template:create');

    const parsed = learnDesignSchema.parse(input);
    const credits = CREDIT_RATES.designLearning;
    const balance = await getBalance(scope);
    const quote = { credits, balance, affordable: balance >= credits };

    if (parsed.dryRun) {
      return { ok: true, dryRun: true, quote };
    }

    // Checked here rather than trusted from the form: the confirmation is the
    // record that someone said they hold rights to these images, and a client
    // that could skip it would make that record worthless.
    if (!parsed.rightsConfirmed) {
      return { ok: false, code: 'rights_not_confirmed' };
    }

    if (!quote.affordable) {
      return { ok: false, code: 'insufficient_credits' };
    }

    // Charged before the call, not after. A charge that waited for success
    // would let the same references be learned repeatedly for free by
    // disconnecting mid-request.
    await spendCredits(scope, {
      amount: credits,
      reason: 'spend.learn',
      idempotencyKey: parsed.idempotencyKey,
    });

    const learned = await learnDesign({
      images: parsed.images,
      ratio: parsed.ratio,
      instruction: parsed.instruction ?? null,
    });

    const margin = checkMargin({
      creditsCharged: credits,
      usage: {
        llmInputTokens: learned.usage.inputTokens,
        llmOutputTokens: learned.usage.outputTokens,
        visionImageCount: learned.usage.imageCount,
      },
    });

    if (!margin.healthy) {
      logger.warn('Design learning charged too close to what it cost', {
        orgId: scope.orgId,
        costUsd: Number(margin.costUsd.toFixed(4)),
        multiple: Number(margin.multiple.toFixed(2)),
      });
    }

    const templateId = await saveLearnedTemplate(scope, {
      name: parsed.name,
      ratio: parsed.ratio,
      layouts: learned.layouts,
      tokens: learned.tokens,
      instruction: parsed.instruction ?? null,
      imageCount: learned.usage.imageCount,
    });

    logger.info('Design learning finished', { orgId: scope.orgId, templateId });
    revalidatePath('/dashboard/templates');

    return { ok: true, dryRun: false, templateId, quote };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Design learning rejected', { code });

    return { ok: false, code: code as LearnFailureCode };
  }
}
