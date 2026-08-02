import { defineConfig } from '@trigger.dev/sdk';

/**
 * Batch generation queue.
 *
 * Generation outlives a serverless function: a month of card news is dozens of
 * model calls, image fetches and renders. Vercel would cut that off, so runs
 * execute here instead.
 *
 * `project` comes from the Trigger.dev dashboard and is not a secret — the
 * `TRIGGER_SECRET_KEY` that authenticates a deploy is, and lives in the
 * environment.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_set_me_from_the_dashboard',
  dirs: ['./src/trigger'],
  maxDuration: 900,
  retries: {
    // A failed run refunds credits, so a retry must not double-charge. Every
    // charge is keyed by the run's idempotency key, which makes that safe.
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
      randomize: true,
    },
  },
});
