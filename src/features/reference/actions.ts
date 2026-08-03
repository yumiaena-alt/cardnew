'use server';

import { CREDIT_RATES } from '@/features/credit/estimate';
import { spendCredits } from '@/features/credit/service';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type { ReferenceSearchInput } from '@/validations/ReferenceValidation';
import { normalizeQuery, referenceSearchSchema } from '@/validations/ReferenceValidation';
import type { Reference } from './provider';
import { isReferenceSearchConfigured, searchReferences } from './provider';

/**
 * Server Action for reference search.
 *
 * The charge is keyed by organization, normalised query and day, so repeating a
 * search — which is what someone does while refining wording — costs once per
 * day rather than once per keypress-driven retry.
 */

/** How many results one search returns. */
const RESULT_LIMIT = 24;

export type ReferenceFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input'
  | 'search_unavailable';

export type ReferenceSearchResult =
  | { ok: true; references: Reference[] }
  | { ok: false; code: ReferenceFailureCode };

/**
 * Runs a reference search, charging one credit per query per day.
 *
 * @param input - Query, kind, and how far back to look.
 * @returns The references found, or a failure code.
 */
export async function runReferenceSearch(
  input: ReferenceSearchInput,
): Promise<ReferenceSearchResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    if (!isReferenceSearchConfigured()) {
      return { ok: false, code: 'search_unavailable' };
    }

    const parsed = referenceSearchSchema.parse(input);
    const day = new Date().toISOString().slice(0, 10);
    const key = `search:${scope.orgId}:${parsed.kind}:${normalizeQuery(parsed.query)}:${day}`;

    await spendCredits(scope, {
      amount: CREDIT_RATES.referenceSearch,
      reason: 'spend.search',
      idempotencyKey: key,
    });

    const references = await searchReferences({
      query: parsed.query,
      kind: parsed.kind,
      windowDays: parsed.windowDays,
      limit: RESULT_LIMIT,
    });

    logger.info('Reference search ran', { orgId: scope.orgId, found: references.length });

    return { ok: true, references };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Reference search rejected', { code });

    return { ok: false, code };
  }
}
