import { anthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs } from 'ai';
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

/** Enough lookups to catch what is happening now, few enough to stay quick. */
const MAX_SEARCHES = 3;

/** One search round, then the answer. Without a stop the model can keep looking. */
const MAX_STEPS = 4;

export type IdeaSource = 'self' | 'web' | 'library';

export type IdeaSeed = {
  source: IdeaSource;
  /** What the business does, in the user's own words. */
  context: string;
  /**
   * Topics this organization has already covered. Only read for the library
   * source, which exists to build on them rather than repeat them.
   */
  priorTopics?: string[];
};

/** What every batch must satisfy, whatever it was drawn from. */
const SHARED_RULES = [
  `Produce exactly ${IDEA_BATCH_SIZE} topics.`,
  'Each topic must be one Korean line, at most 40 characters, concrete enough',
  'to photograph or write today without a studio or a budget.',
  'Return one topic per line. No numbering, no quotes, no extra commentary.',
];

/**
 * The instruction that makes one source differ from another.
 *
 * Without this the three buttons would run the same prompt and differ only in
 * which one looks pressed, which is worse than offering one.
 *
 * @param seed - Source, business context, and any prior topics.
 * @returns The source-specific lines.
 */
function sourceRules(seed: IdeaSeed): string[] {
  if (seed.source === 'web') {
    return [
      'Search the web first for what is current for this kind of business right',
      'now in Korea: the season, what people are asking about, dates worth',
      'posting around. Ground every topic in something you actually found.',
      'Do not invent a trend you did not see.',
    ];
  }

  if (seed.source === 'library') {
    return [
      'Here is what this business has already posted:',
      (seed.priorTopics ?? []).map((topic) => `- ${topic}`).join('\n'),
      'Continue this body of work. Go deeper on what it keeps returning to,',
      'answer what it raised but left open, and revisit what deserves another',
      'pass. Do not repeat a topic in that list.',
    ];
  }

  return ['Vary the angle: tips, behind the scenes, customer questions, seasonal.'];
}

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
    ...sourceRules(seed),
    ...SHARED_RULES,
  ].join('\n');
}

/**
 * Generates a batch of topic ideas.
 *
 * @param seed - Source and the user's description of their business.
 * @returns The ideas, trimmed and de-duplicated.
 */
export async function generateIdeas(seed: IdeaSeed): Promise<string[]> {
  const searches =
    seed.source === 'web'
      ? {
          tools: { web_search: anthropic.tools.webSearch_20260209({ maxUses: MAX_SEARCHES }) },
          stopWhen: stepCountIs(MAX_STEPS),
        }
      : {};

  const result = await generateText({
    model: anthropic(MODEL),
    prompt: buildPrompt(seed),
    ...searches,
  });

  // Prior topics count as already seen, so the library source cannot hand back
  // something the business has already posted.
  const seen = new Set(seed.priorTopics);
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
