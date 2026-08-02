import { tasks } from '@trigger.dev/sdk';
import { logger } from '@/libs/Logger';
import type { GenerateRunPayload, generateRunTask } from '@/trigger/generateRun';

/**
 * Hand-off from the charging path to the worker.
 *
 * Kept apart from the run service so the service can be tested without the
 * queue SDK, and so there is exactly one place that knows how a charged run
 * becomes running work.
 */

/**
 * Queues a charged run for generation.
 *
 * The task is triggered by id, and its module is imported for types only, so
 * the worker bundle never reaches the Next.js server bundle — the task pulls in
 * the renderer client and the model SDK, none of which a request handler needs.
 *
 * The run id is used as the deduplication key, so a retried enqueue attaches to
 * the run already in flight instead of generating it twice against one charge.
 *
 * @param payload - The run to generate and the tenant it belongs to.
 */
export async function enqueueRun(payload: GenerateRunPayload): Promise<void> {
  const handle = await tasks.trigger<typeof generateRunTask>('generate-run', payload, {
    idempotencyKey: `run:${payload.runId}`,
  });

  logger.info('Run enqueued', { orgId: payload.orgId, runId: payload.runId, jobId: handle.id });
}
