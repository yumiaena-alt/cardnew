'use server';

import { revalidatePath } from 'next/cache';
import { loadCurrentBoard, saveBoard } from '@/features/board/service';
import { listDecks } from '@/features/deck/repository';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import type { IdeaRequestInput, PushIdeasInput } from '@/validations/PlanningValidation';
import { ideaRequestSchema, pushIdeasSchema } from '@/validations/PlanningValidation';
import { generateIdeas } from './ideas';

/**
 * Server Actions for content planning.
 *
 * Ideas cost nothing. They are a short text completion, and charging for the
 * step where a user is still deciding what to post would push them to settle
 * for the first list — which is the opposite of what planning is for. Credits
 * start at generation, where the real provider cost is.
 */

/** Why planning could not proceed. Maps one-to-one onto an i18n key. */
export type PlanningFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input'
  | 'planner_unavailable'
  | 'empty_library';

export type IdeaResult = { ok: true; ideas: string[] } | { ok: false; code: PlanningFailureCode };

export type PushResult = { ok: true; added: number } | { ok: false; code: PlanningFailureCode };

/**
 * Maps a thrown value onto a client-safe failure code.
 *
 * @param error - The caught value.
 * @returns The failure code to send back.
 */
function toFailureCode(error: unknown): PlanningFailureCode {
  return error instanceof DomainError ? error.code : 'invalid_input';
}

/** Enough of the back catalogue to show what a business keeps returning to. */
const LIBRARY_SAMPLE = 40;

/**
 * Reads the topics this organization has already covered.
 *
 * @param scope - Tenant scope.
 * @returns Distinct prior topics, most recent first.
 */
async function readPriorTopics(scope: Awaited<ReturnType<typeof getScope>>): Promise<string[]> {
  const decks = await listDecks(scope, LIBRARY_SAMPLE);

  return [
    ...new Set(decks.map((deck) => deck.topic ?? deck.title).filter((topic) => topic !== '')),
  ];
}

/**
 * Produces a batch of topic ideas.
 *
 * @param input - Source and the user's description of their business.
 * @returns The ideas, or a failure code.
 */
export async function requestIdeas(input: IdeaRequestInput): Promise<IdeaResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    if (!Env.ANTHROPIC_API_KEY) {
      return { ok: false, code: 'planner_unavailable' };
    }

    const parsed = ideaRequestSchema.parse(input);

    // The library source builds on work that exists. With nothing to build on it
    // would quietly behave like the plain one, so it says so instead.
    const priorTopics = parsed.source === 'library' ? await readPriorTopics(scope) : undefined;

    if (parsed.source === 'library' && priorTopics?.length === 0) {
      return { ok: false, code: 'empty_library' };
    }

    const ideas = await generateIdeas({ ...parsed, priorTopics });

    return { ok: true, ideas };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Idea request rejected', { code });

    return { ok: false, code };
  }
}

/**
 * Appends chosen ideas to the current month's board.
 *
 * Ideas are written into the sheet rather than a holding area of their own. The
 * Board is where a month gets decided, so an idea that lives anywhere else is
 * one the user has to move by hand before it can become anything.
 *
 * @param input - The topics the user kept.
 * @returns How many rows were added, or a failure code.
 */
export async function pushIdeasToBoard(input: PushIdeasInput): Promise<PushResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const parsed = pushIdeasSchema.parse(input);
    const board = await loadCurrentBoard(scope);

    const existing = board.rows.map((row) => ({
      topic: row.topic ?? '',
      channels: [],
      scheduledAt: row.scheduledAt ?? '',
      notes: row.notes ?? '',
    }));

    // Blank seed rows are replaced rather than pushed down, so arriving at the
    // Board does not mean scrolling past a screen of empty rows first.
    const kept = existing.filter((row) => row.topic.trim() !== '');

    const added = parsed.topics.map((topic) => ({
      topic,
      channels: [],
      scheduledAt: '',
      notes: '',
    }));

    await saveBoard(scope, board.boardId, [...kept, ...added], {});

    logger.info('Ideas pushed to board', { orgId: scope.orgId, count: added.length });
    revalidatePath('/dashboard/board');

    return { ok: true, added: added.length };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Idea push rejected', { code });

    return { ok: false, code };
  }
}
