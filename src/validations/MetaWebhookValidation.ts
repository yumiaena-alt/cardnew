import * as z from 'zod';

/**
 * Zod schemas for the Meta webhook deliveries the automation runtime reads.
 *
 * A delivery carries changes for several fields under one envelope, and only
 * the shape of the envelope is fixed. The value of a change is left unknown
 * here and parsed by the schema for its field, so a payload we do not handle
 * cannot fail the parse of one we do.
 */

const changeSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
});

const entrySchema = z.object({
  /** The Instagram account the change happened on. */
  id: z.string().min(1),
  changes: z.array(changeSchema).default([]),
});

export const metaWebhookSchema = z.object({
  object: z.string().min(1),
  entry: z.array(entrySchema).default([]),
});

/**
 * A comment as the `comments` field reports it.
 *
 * `from` is absent when the commenter's privacy settings withhold it, which is
 * a comment we can still reply to — the reply is addressed to the comment, not
 * to a person we looked up.
 */
export const commentChangeSchema = z.object({
  id: z.string().min(1),
  text: z.string().default(''),
  from: z.object({ id: z.string().min(1), username: z.string().nullish() }).nullish(),
  media: z.object({ id: z.string().min(1) }).nullish(),
});

export type CommentChange = z.infer<typeof commentChangeSchema>;
