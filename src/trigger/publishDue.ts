import { logger as triggerLogger, schedules as triggerSchedules } from '@trigger.dev/sdk';
import { publishDueSchedules } from '@/features/publish/service';

/**
 * The publishing poller.
 *
 * Runs on a fixed cadence rather than one timer per booking. A timer per post
 * would mean thousands of pending jobs and no way to recover the ones lost when
 * a deploy interrupts them; a poll reads the same table the user edits, so a
 * booking made a minute ago and one made last month are handled identically.
 *
 * Every five minutes: fine enough that "9am" means 9am to a reader, coarse
 * enough that an idle account costs almost nothing.
 */

/** Enough for a busy month's morning without one poll running for ever. */
const BATCH_LIMIT = 20;

export const publishDueTask = triggerSchedules.task({
  id: 'publish-due-schedules',
  cron: '*/5 * * * *',
  run: async () => {
    const result = await publishDueSchedules({ limit: BATCH_LIMIT });

    if (result.claimed > 0) {
      triggerLogger.info('Publish poll finished', result);
    }

    return result;
  },
});
