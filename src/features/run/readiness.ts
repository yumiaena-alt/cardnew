import { Env } from '@/libs/Env';

/**
 * Whether the generation pipeline can actually finish a run.
 *
 * Checked before a charge, not during one. Every stage below is required for a
 * run to produce anything: without the queue nothing starts, without the render
 * service there are no images, and without storage there is nowhere to put them.
 * Charging first and discovering the gap at the last step would leave the user
 * paying for a refund cycle.
 *
 * Only configuration is inspected here — reachability is the worker's problem,
 * because a service that is up when a run is quoted can still be down a minute
 * later, and the worker already refunds what it cannot deliver.
 */

/** A stage of the pipeline that has to be configured for a run to complete. */
export type PipelineStage = 'queue' | 'render' | 'storage';

/** The subset of the environment generation depends on. */
export type PipelineEnv = {
  TRIGGER_SECRET_KEY?: string | undefined;
  RENDER_SERVICE_URL?: string | undefined;
  RENDER_SERVICE_TOKEN?: string | undefined;
  SUPABASE_URL?: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
};

/**
 * Lists the pipeline stages that are not configured.
 *
 * Takes the environment as an argument so the rule can be tested by passing
 * configurations rather than by mocking the validated `Env` module.
 *
 * @param env - Environment to inspect. Defaults to the validated one.
 * @returns The missing stages, empty when generation is ready.
 */
export function findMissingStages(env: PipelineEnv = Env): PipelineStage[] {
  const missing: PipelineStage[] = [];

  if (!env.TRIGGER_SECRET_KEY) {
    missing.push('queue');
  }

  if (!(env.RENDER_SERVICE_URL && env.RENDER_SERVICE_TOKEN)) {
    missing.push('render');
  }

  if (!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) {
    missing.push('storage');
  }

  return missing;
}
