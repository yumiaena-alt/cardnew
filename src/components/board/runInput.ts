import type { RunItemInput } from '@/validations/RunValidation';
import type { FanoutChannelId } from './FanoutCell';
import { FANOUT_CHANNELS, parseFanout } from './FanoutCell';
import type { SheetRow } from './useBoardSheet';

/**
 * Turns Board sheet rows into run input.
 *
 * The sheet is free-form on purpose — a user pastes a month of topics and
 * leaves gaps — so this is where loose rows become something the run entry
 * point will accept. Rows that would generate nothing are dropped here rather
 * than being sent and rejected, which keeps the estimate and what actually runs
 * in agreement.
 */

type TargetRatio = RunItemInput['targets'][number]['ratio'];

// Typed on the way in rather than asserted on the way out: the ratios declared
// on FANOUT_CHANNELS are literals, so a channel whose ratio is not a real enum
// value fails to compile here instead of at the server boundary.
const RATIO_BY_CHANNEL = new Map<FanoutChannelId, TargetRatio>(
  FANOUT_CHANNELS.map((channel) => [channel.id, channel.ratio]),
);

/**
 * Builds the targets for one row, marking the first selected channel as origin.
 *
 * @param channels - Channels selected on the row, in the order shown.
 * @returns Fan-out targets, or an empty array when nothing is selected.
 */
function toTargets(channels: readonly FanoutChannelId[]): RunItemInput['targets'] {
  return channels.flatMap((channel, index) => {
    const ratio = RATIO_BY_CHANNEL.get(channel);

    if (!ratio) {
      return [];
    }

    return [{ channel, ratio, isOrigin: index === 0 }];
  });
}

/**
 * Converts sheet rows into run items, skipping rows that cannot generate.
 *
 * A row is skipped when it has no topic or no selected channel. That mirrors
 * `estimateBoardCredits`, so the count in the header and the number of items
 * sent to the server cannot disagree.
 *
 * @param rows - Current sheet rows.
 * @returns Run items in sheet order.
 */
export function toRunItems(rows: readonly SheetRow[]): RunItemInput[] {
  return rows.flatMap((row) => {
    const topic = (row.topic ?? '').trim();
    const targets = toTargets(parseFanout(row.fanout ?? ''));

    if (topic === '' || targets.length === 0) {
      return [];
    }

    return [{ topic, targets }];
  });
}
