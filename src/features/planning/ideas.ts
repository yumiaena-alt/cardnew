import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { logger } from '@/libs/Logger';

/**
 * Topic ideas for a month of posting.
 *
 * Planning is deliberately separate from generation: deciding what to post is
 * cheap and iterative, while making the cards is not. Ideas are produced here,
 * discarded freely, and only become expensive once the user pushes the ones
 * they like into the Board and runs them.
 */

/** One batch is a month of posting for a solo operator, not a content farm. */
const IDEA_BATCH_SIZE = 12;

const MODEL = 'claude-sonnet-4-5';

export type IdeaSource = 'self' | 'web' | 'library';

export type IdeaSeed = {
  source: IdeaSource;
  /** What the business does, in the user's own words. */
  context: string;
};

/**
 * Builds the instruction for one idea batch.
 *
 * The prompt asks for topics a solo operator could actually shoot or write
 * today: an idea that needs a studio is an idea that never gets posted.
 *
 * @param seed - Source and the user's description of their business.
 * @returns The prompt text.
 */
function buildPrompt(seed: IdeaSeed): string {
  return [
    'You plan social card-news topics for a solo business owner in Korea.',
    `Business context: ${seed.context}`,
    `Produce exactly ${IDEA_BATCH_SIZE} topics.`,
    'Each topic must be one Korean line, at most 40 characters, concrete enough',
    'to photograph or write today without a studio or a budget.',
    'Vary the angle: tips, behind the scenes, customer questions, seasonal.',
    'Return one topic per line. No numbering, no quotes, no extra commentary.',
  ].join('\n');
}

/**
 * Generates a batch of topic ideas.
 *
 * @param seed - Source and the user's description of their business.
 * @returns The ideas, trimmed and de-duplicated.
 */
export async function generateIdeas(seed: IdeaSeed): Promise<string[]> {
  const result = await generateText({
    model: anthropic(MODEL),
    prompt: buildPrompt(seed),
  });

  const seen = new Set<string>();
  const ideas: string[] = [];

  for (const line of result.text.split('\n')) {
    const topic = line.trim().replace(/^[\d.\-*\s]+/u, '');

    if (topic !== '' && topic.length <= 60 && !seen.has(topic)) {
      seen.add(topic);
      ideas.push(topic);
    }
  }

  logger.info('Ideas generated', { source: seed.source, count: ideas.length });

  return ideas.slice(0, IDEA_BATCH_SIZE);
}
