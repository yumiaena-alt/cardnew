import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

/**
 * Long-form drafting.
 *
 * The model returns Markdown and nothing else. A draft that arrives wrapped in
 * commentary has to be cleaned before anyone can paste it anywhere, which is
 * work the tool exists to remove.
 */

const MODEL = 'claude-sonnet-4-5';

/** Long enough to rank, short enough that a solo operator will actually edit it. */
const TARGET_WORDS = 800;

export type BlogDraft = {
  title: string;
  body: string;
};

/**
 * Splits the first heading off the draft to use as the title.
 *
 * @param markdown - The generated draft.
 * @param fallback - Title to use when the draft has no heading.
 * @returns The title and the remaining body.
 */
function splitTitle(markdown: string, fallback: string): BlogDraft {
  const lines = markdown.trim().split('\n');
  const first = lines[0]?.trim() ?? '';

  if (first.startsWith('# ')) {
    return { title: first.slice(2).trim(), body: lines.slice(1).join('\n').trim() };
  }

  return { title: fallback, body: markdown.trim() };
}

/**
 * Writes a blog draft on a topic.
 *
 * @param topic - What the post should be about.
 * @returns The drafted title and Markdown body.
 */
export async function writeBlogDraft(topic: string): Promise<BlogDraft> {
  const result = await generateText({
    model: anthropic(MODEL),
    prompt: [
      'You write blog posts for a solo business owner in Korea.',
      `Topic: ${topic}`,
      `Write about ${TARGET_WORDS} words in Korean.`,
      'Open with a single H1 line, then use H2 sections.',
      "Write from the owner's own point of view, concrete and specific.",
      'No filler intros, no "in conclusion", no invented statistics or quotes.',
      'Return Markdown only, with no commentary before or after it.',
    ].join('\n'),
  });

  return splitTitle(result.text, topic);
}
