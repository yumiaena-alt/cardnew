import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod';
import { logger } from '@/libs/Logger';
import type { PanelLayoutSpec } from '@/models/Template';

/**
 * Reading a design out of reference images.
 *
 * The output is a template, not a picture: normalised slot boxes and style
 * tokens that the composer can lay any copy into. Learning that produced an
 * image would only be able to reproduce the reference — what makes it reusable
 * is that the structure comes back without the content.
 *
 * Boxes are fractions of the canvas rather than pixels so one learned design
 * survives a ratio change, which is the whole reason fan-out does not need a
 * separate design per channel.
 */

const MODEL = 'claude-sonnet-4-5';

/** Ten is the provider's own limit on images in one request, and enough. */
export const MAX_REFERENCE_IMAGES = 10;

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const slotSchema = z.object({
  key: z.string().min(1).max(40),
  type: z.enum(['text', 'image', 'shape']),
  box: boxSchema,
  maxChars: z.number().int().positive().max(500).optional(),
});

const layoutSchema = z.object({
  role: z.enum(['cover', 'body', 'cta']),
  slots: z.array(slotSchema).min(1).max(12),
});

/**
 * What the model is asked to produce.
 *
 * Tokens are named rather than free-form so a learned design can be applied by
 * the same composer that applies a built-in one. A model left to invent its own
 * token names produces a template nothing knows how to read.
 */
const designSchema = z.object({
  layouts: z.array(layoutSchema).min(1).max(3),
  tokens: z.object({
    backgroundColor: z.string(),
    textColor: z.string(),
    accentColor: z.string(),
    headlineWeight: z.string(),
    bodyWeight: z.string(),
    /** Outer margin as a fraction of the canvas, written as a decimal string. */
    margin: z.string(),
    /** Gap between stacked elements, as a fraction of canvas height. */
    gap: z.string(),
    textAlign: z.enum(['left', 'center', 'right']),
  }),
});

export type LearnedDesign = {
  layouts: PanelLayoutSpec[];
  tokens: Record<string, string>;
  usage: { inputTokens: number; outputTokens: number; imageCount: number };
};

export type LearnInput = {
  /** Reference images as data URLs or public URLs the model can read. */
  images: string[];
  ratio: string;
  /** What the user asked for beyond the images themselves. */
  instruction: string | null;
};

/**
 * Builds the instruction for one learning pass.
 *
 * @param input - Images, ratio and any custom direction.
 * @returns The prompt text.
 */
function buildPrompt(input: LearnInput): string {
  return [
    'These are reference card news designs. Describe the design system behind',
    'them as a reusable template, not as a copy of any one image.',
    `Target ratio: ${input.ratio}.`,
    'Give a layout per role you can see: cover, body, cta. Omit roles absent',
    'from the references rather than inventing them.',
    'Every box is a fraction of the canvas: x and y are the top-left corner,',
    'w and h the size. They must sit inside 0 to 1 and must not overlap unless',
    'the reference clearly layers them.',
    'Slot keys are their purpose in lowercase: headline, body, eyebrow, cta,',
    'background, pagenum. Reuse the same key across layouts for the same role.',
    'Colours are hex. Weights are numbers between 100 and 900 as strings.',
    input.instruction === null ? '' : `The user also asks: ${input.instruction}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Extracts a reusable design from reference images.
 *
 * @param input - Reference images, target ratio and any custom direction.
 * @returns The layouts, tokens, and what the call cost in tokens.
 * @throws Error when more references are supplied than the provider accepts.
 */
export async function learnDesign(input: LearnInput): Promise<LearnedDesign> {
  if (input.images.length === 0 || input.images.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`Reference images must be between 1 and ${MAX_REFERENCE_IMAGES}`);
  }

  const result = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema: designSchema }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(input) },
          ...input.images.map((image) => ({ type: 'image' as const, image })),
        ],
      },
    ],
  });

  const design = result.output;

  logger.info('Design learned', {
    layouts: design.layouts.length,
    images: input.images.length,
  });

  return {
    layouts: design.layouts,
    tokens: design.tokens,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      imageCount: input.images.length,
    },
  };
}
