'use server';

import { DomainError } from '@/features/shared/errors';
import { getScope } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type { CreateRunInput } from '@/validations/RunValidation';
import type { RunEstimate } from './estimate';
import { findMissingStages } from './readiness';
import { createRun } from './service';

/**
 * Server Action entry point for generation.
 *
 * Errors cross back as a `code` rather than a thrown error: the messages the
 * domain layer raises are written for operators and name internal ids, so the
 * client gets the code and resolves its own translated copy.
 */

/** Why a run could not start. Maps one-to-one onto an i18n key on the client. */
export type RunFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input'
  | 'queue_unavailable';

export type RunActionResult =
  | { ok: true; dryRun: true; estimate: RunEstimate }
  | { ok: true; dryRun: false; runId: string; chargedCredits: number }
  | { ok: false; code: RunFailureCode };

/**
 * Maps a thrown value onto a client-safe failure code.
 *
 * @param error - The caught value.
 * @returns The failure code to send back.
 */
function toFailureCode(error: unknown): RunFailureCode {
  if (error instanceof DomainError) {
    return error.code;
  }

  return 'invalid_input';
}

/**
 * Quotes or starts a generation run.
 *
 * A real run is refused unless every stage of the pipeline is configured. The
 * check sits here, before `createRun`, so a gap costs the user nothing: no
 * ledger entry is written at all. A quote is always allowed, because seeing
 * what something would cost does not depend on being able to build it.
 *
 * @param input - Items, regeneration scope, idempotency key, and dry-run flag.
 * @returns The estimate, the started run, or a failure code.
 */
export async function submitRun(input: CreateRunInput): Promise<RunActionResult> {
  try {
    const scope = await getScope();

    const missing = input.dryRun ? [] : findMissingStages();

    if (missing.length > 0) {
      logger.warn('Run refused: pipeline incomplete', {
        orgId: scope.orgId,
        missing: missing.join(','),
      });

      return { ok: false, code: 'queue_unavailable' };
    }

    const result = await createRun(scope, input);

    if (result.dryRun) {
      return { ok: true, dryRun: true, estimate: result.estimate };
    }

    logger.info('Run queued', {
      orgId: scope.orgId,
      runId: result.run.id,
      credits: result.run.chargedCredits,
    });

    return {
      ok: true,
      dryRun: false,
      runId: result.run.id,
      chargedCredits: result.run.chargedCredits,
    };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Run rejected', { code });

    return { ok: false, code };
  }
}
