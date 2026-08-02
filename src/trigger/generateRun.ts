import { logger as triggerLogger, task } from '@trigger.dev/sdk';
import { findDefaultProjectId } from '@/features/deck/repository';
import { generateCut } from '@/features/run/pipeline';
import { findRun, listRunItems, updateRun, updateRunItem } from '@/features/run/repository';
import type { RunItemOutcome } from '@/features/run/service';
import { finalizeRun } from '@/features/run/service';
import type { Scope } from '@/features/shared/scope';
import type { CardnewsPlan } from '@/lib/plan/schema';
import { isRenderServiceReachable } from '@/libs/RenderService';
import type { RunItem } from '@/models/Run';

/**
 * Executes a charged run.
 *
 * Step 8 of the pipeline in docs/02-ARCHITECTURE.md §5-2. The run is already
 * paid for by the time this starts, so the job's real responsibility is making
 * sure the user ends up with either the cards or the credits back — never
 * neither.
 *
 * Partial failure is expected and tolerated, with one exception. If the very
 * first cut fails, the rest are abandoned rather than attempted: the usual
 * cause is the model or the renderer being unreachable, and grinding through
 * fifty cards that will all fail the same way wastes minutes and provider spend
 * before refunding anyway.
 */

export type GenerateRunPayload = {
  runId: string;
  orgId: string;
  userId: string;
};

/**
 * Groups reusable plans by source topic so derived cuts skip planning.
 *
 * Keyed by topic rather than by row: two rows with identical text are the same
 * writing job, and the origin of one can seed the other.
 */
type PlanCache = Map<string, CardnewsPlan>;

type CutOutcome = {
  outcome: RunItemOutcome;
  usage: { inputTokens: number; outputTokens: number };
  panelCount: number;
};

/**
 * Generates one item and turns any failure into an outcome.
 *
 * @param input - Scope, the item, the owning project, and the shared plan cache.
 * @returns The outcome to record, plus what it cost.
 */
async function runOneCut(input: {
  scope: Scope;
  item: RunItem;
  projectId: string;
  plans: PlanCache;
}): Promise<CutOutcome> {
  const empty = { inputTokens: 0, outputTokens: 0 };

  try {
    await updateRunItem(input.scope, input.item.runId, input.item.id, {
      status: 'running',
      attempts: input.item.attempts + 1,
    });

    const result = await generateCut({
      scope: input.scope,
      item: input.item,
      projectId: input.projectId,
      createdBy: input.scope.userId,
      plan: input.item.isOrigin ? undefined : input.plans.get(input.item.topic),
    });

    if (input.item.isOrigin) {
      input.plans.set(input.item.topic, result.plan);
    }

    return {
      outcome: { itemId: input.item.id, status: 'done', deckId: result.deckId },
      usage: result.usage,
      panelCount: result.panelCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';

    triggerLogger.error('Cut failed', { itemId: input.item.id, message });

    return {
      outcome: { itemId: input.item.id, status: 'failed', errorMessage: message },
      usage: empty,
      panelCount: 0,
    };
  }
}

export const generateRunTask = task({
  id: 'generate-run',
  // One month of cards is dozens of model calls and renders. The ceiling is
  // generous because being cut off mid-batch is worse than being slow.
  maxDuration: 900,
  run: async (payload: GenerateRunPayload) => {
    const scope: Scope = {
      orgId: payload.orgId,
      userId: payload.userId,
      // The worker acts on the tenant without a session. Only `orgId` and
      // `userId` are read below; the rest exist to satisfy the type.
      clerkOrgId: '',
      clerkUserId: '',
      role: 'owner',
      planKey: '',
    };

    const run = await findRun(scope, payload.runId);

    if (!run) {
      throw new Error(`Run ${payload.runId} not found`);
    }

    const items = await listRunItems(scope, payload.runId);
    const projectId = await findDefaultProjectId(scope);

    if (!projectId) {
      throw new Error(`Organization ${payload.orgId} has no default project`);
    }

    if (!(await isRenderServiceReachable())) {
      throw new Error('Render service is unreachable');
    }

    await updateRun(scope, payload.runId, { status: 'running', startedAt: new Date() });

    // Origins first, so every derived cut finds its plan already cached.
    const ordered = items.toSorted((a, b) => Number(b.isOrigin) - Number(a.isOrigin));
    const plans: PlanCache = new Map();
    const outcomes: RunItemOutcome[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let panelCount = 0;

    for (const [position, item] of ordered.entries()) {
      const result = await runOneCut({ scope, item, projectId, plans });

      outcomes.push(result.outcome);
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      panelCount += result.panelCount;

      if (position === 0 && result.outcome.status === 'failed') {
        triggerLogger.error('First cut failed, abandoning the rest', { runId: payload.runId });

        outcomes.push(
          ...ordered.slice(1).map(
            (rest): RunItemOutcome => ({
              itemId: rest.id,
              status: 'canceled',
            }),
          ),
        );

        break;
      }
    }

    const closed = await finalizeRun(scope, payload.runId, {
      outcomes,
      costSnapshot: {
        llmInputTokens: inputTokens,
        llmOutputTokens: outputTokens,
        imageCount: panelCount,
        // Filled in once provider pricing is wired to the ledger; the token and
        // image counts above are what a cost review actually needs first.
        providerCostUsd: 0,
      },
    });

    return {
      runId: closed.id,
      status: closed.status,
      refundedCredits: closed.refundedCredits,
      delivered: outcomes.filter((outcome) => outcome.status === 'done').length,
    };
  },
});
