import * as z from 'zod';

/**
 * Zod schema for drafting a blog post.
 *
 * The idempotency key comes from the client so a double submit — a slow network
 * and an impatient second click — charges once. It is the client that knows the
 * two clicks were the same intent.
 */

export const writeBlogSchema = z.object({
  topic: z.string().min(2).max(500),
  idempotencyKey: z.string().min(1).max(200),
});

export type WriteBlogInput = z.infer<typeof writeBlogSchema>;
