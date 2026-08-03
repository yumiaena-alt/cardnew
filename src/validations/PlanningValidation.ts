import * as z from 'zod';

/**
 * Zod schemas for content planning.
 *
 * The context field is what the user tells the model about their business, so
 * it is bounded on the way in: it becomes prompt text, and an unbounded prompt
 * is an unbounded bill.
 */

export const ideaRequestSchema = z.object({
  source: z.enum(['self', 'web', 'library']),
  context: z.string().min(2).max(300),
});

export const pushIdeasSchema = z.object({
  topics: z.array(z.string().min(1).max(60)).min(1).max(50),
});

export type IdeaRequestInput = z.infer<typeof ideaRequestSchema>;
export type PushIdeasInput = z.infer<typeof pushIdeasSchema>;
