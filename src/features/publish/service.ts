import { getDeckView } from '@/features/deck/service';
import { conflictError, notFoundError } from '@/features/shared/errors';
import type { OrgScope, Scope } from '@/features/shared/scope';
import { findAccountCredential } from '@/features/social/repository';
import { decryptSecret } from '@/libs/Crypto';
import { logger } from '@/libs/Logger';
import type { Schedule } from '@/models/Publish';
import { publishToInstagram } from './publisher';
import {
  cancelSchedule,
  claimDueSchedules,
  insertSchedule,
  recordPublication,
  settleSchedule,
} from './repository';

/**
 * Booking a post and, when its time comes, putting it out.
 *
 * Publishing is the one thing here that touches the outside world, and it is
 * kept away from the request path deliberately: a post goes out on a schedule,
 * so the worker owns it. What a user does is book and cancel.
 */

export type ScheduleInput = {
  deckId: string;
  socialAccountId: string;
  scheduledAt: Date;
  caption: string | null;
  hashtags: string[];
};

/**
 * Books a deck to go out on an account.
 *
 * Both the deck and the account are re-read under the caller's scope rather
 * than trusted from the form: the ids arrive from a browser, and a booking that
 * accepted them as given would publish one tenant's cards from another's
 * account.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param input - The deck, the account, when, and what to say.
 * @returns The booking.
 * @throws DomainError `not_found` when the deck or account is not the caller's,
 * and `conflict` when the same post is already booked for that instant.
 */
export async function schedulePost(scope: Scope, input: ScheduleInput): Promise<Schedule> {
  const [deck, account] = await Promise.all([
    getDeckView(scope, input.deckId),
    findAccountCredential(scope, input.socialAccountId),
  ]);

  if (!(deck && account)) {
    throw notFoundError('Deck or account not found for this organization');
  }

  const booking = await insertSchedule(scope, {
    deckId: input.deckId,
    socialAccountId: input.socialAccountId,
    scheduledAt: input.scheduledAt,
    caption: input.caption,
    hashtags: input.hashtags,
    createdBy: scope.userId,
  });

  if (!booking) {
    throw conflictError('This deck is already booked for that account and time');
  }

  logger.info('Post scheduled', { orgId: scope.orgId, deckId: input.deckId });

  return booking;
}

/**
 * Calls off a booking that has not started.
 *
 * @param scope - Tenant scope from `getScope()`.
 * @param scheduleId - The booking.
 * @throws DomainError `not_found` when it is not the caller's or already running.
 */
export async function unschedulePost(scope: Scope, scheduleId: string): Promise<void> {
  const canceled = await cancelSchedule(scope, scheduleId);

  if (!canceled) {
    throw notFoundError('Schedule not found or already started');
  }

  logger.info('Post unscheduled', { orgId: scope.orgId });
}

/**
 * Builds the caption that goes out with the cards.
 *
 * @param schedule - The booking.
 * @param fallback - The deck title, used when no caption was written.
 * @returns The caption text.
 */
function composeCaption(schedule: Schedule, fallback: string): string {
  const body = (schedule.caption ?? '').trim() === '' ? fallback : (schedule.caption ?? '');
  const tags = schedule.hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));

  return tags.length === 0 ? body : `${body}\n\n${tags.join(' ')}`;
}

/**
 * Puts one claimed booking out.
 *
 * @param schedule - A booking already marked `publishing`.
 * @returns Whether it published.
 */
async function publishOne(schedule: Schedule): Promise<boolean> {
  const scope: OrgScope = { orgId: schedule.orgId };
  const [deck, account] = await Promise.all([
    getDeckView(scope, schedule.deckId),
    findAccountCredential(scope, schedule.socialAccountId),
  ]);

  if (!(deck && account?.accessTokenCipher)) {
    await settleSchedule(schedule.id, {
      published: false,
      errorMessage: 'deck_or_account_missing',
    });

    return false;
  }

  const imageUrls = deck.panels
    .map((panel) => panel.imageUrl)
    .filter((url): url is string => url !== null);

  if (imageUrls.length === 0) {
    await settleSchedule(schedule.id, { published: false, errorMessage: 'no_rendered_images' });

    return false;
  }

  const result = await publishToInstagram({
    accountExternalId: account.externalId,
    accessToken: decryptSecret(account.accessTokenCipher),
    imageUrls,
    caption: composeCaption(schedule, deck.deck.title),
  });

  if (!result.ok) {
    await settleSchedule(schedule.id, { published: false, errorMessage: result.error });

    return false;
  }

  await recordPublication(scope, {
    scheduleId: schedule.id,
    deckId: schedule.deckId,
    socialAccountId: schedule.socialAccountId,
    externalPostId: result.externalPostId,
    permalink: result.permalink,
  });

  await settleSchedule(schedule.id, { published: true });
  logger.info('Post published', {
    orgId: scope.orgId,
    deckId: schedule.deckId,
    skippedPanels: result.skippedPanels,
  });

  return true;
}

/**
 * Publishes everything that has come due.
 *
 * Marked `@public` because the only caller is the scheduled task, which the
 * queue CLI reaches by scanning `src/trigger` rather than through an import.
 *
 * Bookings are taken one batch at a time and each is published on its own. One
 * account's expired token must not stop another tenant's post from going out,
 * so a failure is recorded against its own booking and the loop continues.
 *
 * @param input - How many to take and the instant that decides what is due.
 * @returns How many were claimed and how many went out.
 * @public
 */
export async function publishDueSchedules(input: {
  limit: number;
  now?: Date;
}): Promise<{ claimed: number; published: number }> {
  const claimed = await claimDueSchedules({ limit: input.limit, now: input.now ?? new Date() });
  let published = 0;

  for (const schedule of claimed) {
    // Sequential: each one uploads several images to the same provider, and
    // running the batch at once is how a rate limit turns into a failed post.
    if (await publishOne(schedule)) {
      published += 1;
    }
  }

  return { claimed: claimed.length, published };
}
