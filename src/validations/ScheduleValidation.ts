import * as z from 'zod';

/**
 * Booking a post.
 *
 * The instant is validated as being ahead of now. A booking in the past would
 * be claimed by the very next poll and go out immediately, which is not what
 * anyone means when they pick yesterday by mistake.
 */

/** Instagram's own caption ceiling. */
const CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;

export const scheduleSchema = z.object({
  deckId: z.uuid(),
  socialAccountId: z.uuid(),
  scheduledAt: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: 'scheduled_in_past',
  }),
  caption: z.string().max(CAPTION_MAX).nullish(),
  hashtags: z.array(z.string().min(1).max(100)).max(HASHTAG_MAX).default([]),
});

export const unscheduleSchema = z.object({
  scheduleId: z.uuid(),
});

export type ScheduleFormInput = z.input<typeof scheduleSchema>;
