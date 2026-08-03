'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type { ScheduleFormInput } from '@/validations/ScheduleValidation';
import { scheduleSchema, unscheduleSchema } from '@/validations/ScheduleValidation';
import { schedulePost, unschedulePost } from './service';

/**
 * Server Actions for scheduled posts.
 *
 * Failures come back as codes rather than messages. The domain errors carry
 * internal ids in their text, and a code is also what the client turns into an
 * i18n key without a round trip through English.
 */

type ScheduleFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid_input';

export type ScheduleResult = { ok: true } | { ok: false; code: ScheduleFailureCode };

/**
 * Maps a thrown value onto a client-safe failure code.
 *
 * @param error - The caught value.
 * @returns The failure code.
 */
function toFailureCode(error: unknown): ScheduleFailureCode {
  if (!(error instanceof DomainError)) {
    return 'invalid_input';
  }

  return error.code === 'insufficient_credits' ? 'invalid_input' : error.code;
}

/**
 * Books a deck to go out.
 *
 * @param input - Deck, account, when, and what to say.
 * @returns Success, or a failure code.
 */
export async function createSchedule(input: ScheduleFormInput): Promise<ScheduleResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const parsed = scheduleSchema.parse(input);

    await schedulePost(scope, {
      deckId: parsed.deckId,
      socialAccountId: parsed.socialAccountId,
      scheduledAt: parsed.scheduledAt,
      caption: parsed.caption ?? null,
      hashtags: parsed.hashtags,
    });

    revalidatePath(`/dashboard/deck/${parsed.deckId}`);
    revalidatePath('/dashboard/calendar');

    return { ok: true };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Schedule rejected', { code });

    return { ok: false, code };
  }
}

/**
 * Calls off a booking.
 *
 * @param input - The booking to cancel.
 * @returns Success, or a failure code.
 */
export async function removeSchedule(input: { scheduleId: string }): Promise<ScheduleResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const parsed = unscheduleSchema.parse(input);
    await unschedulePost(scope, parsed.scheduleId);

    revalidatePath('/dashboard/calendar');

    return { ok: true };
  } catch (error) {
    return { ok: false, code: toFailureCode(error) };
  }
}
