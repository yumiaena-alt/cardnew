import { and, asc, between, eq, inArray, lte, sql } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { NewSchedule, Publication, Schedule } from '@/models/Publish';
import { publications, schedules } from '@/models/Publish';

/**
 * Scheduled posts and the record of what went out.
 *
 * The worker's claim query and the tenant's own queries live side by side here,
 * and only the tenant ones are scoped: a poller has no session, and filtering
 * its work by an organization would mean one tenant's backlog could starve
 * another's.
 */

/** Stops a post that keeps failing from being retried until the heat death. */
const MAX_ATTEMPTS = 3;

/**
 * Books a post.
 *
 * The same deck, account and instant is treated as the same booking rather than
 * a second one — a double click on the schedule button is the ordinary way that
 * happens, and the second row would put the same cards out twice.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The schedule to store, minus `orgId`.
 * @returns The schedule, or null when it was already booked.
 */
export async function insertSchedule(
  scope: OrgScope,
  input: Omit<NewSchedule, 'orgId'>,
): Promise<Schedule | null> {
  const [row] = await db
    .insert(schedules)
    .values({ ...input, orgId: scope.orgId })
    .onConflictDoNothing({
      target: [schedules.deckId, schedules.socialAccountId, schedules.scheduledAt],
    })
    .returning();

  return row ?? null;
}

/**
 * Lists what a deck is booked for.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param deckId - The deck.
 * @returns Its schedules, soonest first.
 */
export async function listSchedulesForDeck(scope: OrgScope, deckId: string): Promise<Schedule[]> {
  return await db
    .select()
    .from(schedules)
    .where(orgScoped(scope, schedules, eq(schedules.deckId, deckId)))
    .orderBy(asc(schedules.scheduledAt));
}

/**
 * Lists everything booked inside a window.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param range - The window, inclusive of both ends.
 * @returns The schedules, soonest first.
 */
export async function listSchedulesInRange(
  scope: OrgScope,
  range: { from: Date; to: Date },
): Promise<Schedule[]> {
  return await db
    .select()
    .from(schedules)
    .where(orgScoped(scope, schedules, between(schedules.scheduledAt, range.from, range.to)))
    .orderBy(asc(schedules.scheduledAt));
}

/**
 * Calls off a booking.
 *
 * Only one that has not started. A post already going out cannot be recalled,
 * and pretending otherwise would leave the user believing nothing was posted.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param scheduleId - The booking to cancel.
 * @returns The canceled schedule, or null when it was not cancellable.
 */
export async function cancelSchedule(
  scope: OrgScope,
  scheduleId: string,
): Promise<Schedule | null> {
  const [row] = await db
    .update(schedules)
    .set({ status: 'canceled' })
    .where(
      orgScoped(scope, schedules, eq(schedules.id, scheduleId), eq(schedules.status, 'pending')),
    )
    .returning();

  return row ?? null;
}

/**
 * Takes the next due bookings for this worker alone.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes two pollers safe to run at once: each
 * one steps over the rows the other has taken instead of blocking on them, so a
 * second instance adds throughput rather than duplicate posts.
 *
 * Attempts are counted here, at the moment of claiming, so a worker that dies
 * mid-publish still burns an attempt. Counting on completion would let a job
 * that reliably crashes retry forever.
 *
 * @param input - How many to take and the instant that decides what is due.
 * @returns The claimed schedules, now marked `publishing`.
 */
export async function claimDueSchedules(input: { limit: number; now: Date }): Promise<Schedule[]> {
  const due = db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(eq(schedules.status, 'pending'), lte(schedules.scheduledAt, input.now)))
    .orderBy(asc(schedules.scheduledAt))
    .limit(input.limit)
    .for('update', { skipLocked: true });

  return await db
    .update(schedules)
    .set({ status: 'publishing', attempts: sql`${schedules.attempts} + 1` })
    .where(inArray(schedules.id, due))
    .returning();
}

/**
 * Records how a claimed booking ended.
 *
 * A failure goes back to `pending` while attempts remain, which is what makes a
 * transient network fault self-healing. Once they run out it stays `failed`, so
 * a broken connection surfaces to the user instead of retrying in silence.
 *
 * @param scheduleId - The booking.
 * @param outcome - Whether it published, and why not when it did not.
 */
export async function settleSchedule(
  scheduleId: string,
  outcome: { published: boolean; errorMessage?: string },
): Promise<void> {
  const status = outcome.published
    ? 'published'
    : sql`case when ${schedules.attempts} >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end::"cardnews"."schedule_status"`;

  await db
    .update(schedules)
    .set({ status, errorMessage: outcome.errorMessage ?? null })
    .where(eq(schedules.id, scheduleId));
}

/**
 * Records a post that went out.
 *
 * Written against the network's own post id, so a worker that published and
 * then died before recording it produces the same row on retry rather than a
 * second one.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The publication to store, minus `orgId`.
 * @returns The stored publication.
 */
export async function recordPublication(
  scope: OrgScope,
  input: {
    scheduleId: string;
    deckId: string;
    socialAccountId: string;
    externalPostId: string;
    permalink: string | null;
  },
): Promise<Publication | null> {
  const [row] = await db
    .insert(publications)
    .values({ ...input, orgId: scope.orgId })
    .onConflictDoUpdate({
      target: [publications.socialAccountId, publications.externalPostId],
      set: { permalink: input.permalink, scheduleId: input.scheduleId },
    })
    .returning();

  return row ?? null;
}
