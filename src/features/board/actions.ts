'use server';

import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type { SaveBoardInput } from '@/validations/BoardValidation';
import { saveBoardSchema } from '@/validations/BoardValidation';
import { saveBoard } from './service';

/**
 * Server Action for board persistence.
 *
 * A save is fire-and-forget from the sheet's point of view: the grid has
 * already applied the edit locally, so a failed write must not roll the user's
 * typing back. It reports the failure and lets them keep working.
 */

export type SaveBoardResult = { ok: true } | { ok: false; code: string };

/**
 * Persists the current state of the sheet.
 *
 * @param input - Board id, rows, and the ratio each channel renders at.
 * @returns Success, or a failure code.
 */
export async function saveBoardRows(input: SaveBoardInput): Promise<SaveBoardResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const parsed = saveBoardSchema.parse(input);

    await saveBoard(scope, parsed.boardId, parsed.rows, parsed.channelRatios);

    return { ok: true };
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'invalid_input';

    logger.warn('Board save rejected', { code });

    return { ok: false, code };
  }
}
