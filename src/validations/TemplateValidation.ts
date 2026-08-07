import * as z from 'zod';
import { MAX_REFERENCE_IMAGES } from '@/features/template/learn';
import { ratioEnum } from '@/models/Enums';

/**
 * Zod schemas for learning a design from reference images.
 *
 * The images arrive as data URLs from the browser rather than as uploads with
 * a URL of their own: they are read once and not kept, so putting them in
 * storage first would mean holding someone else's work for no reason.
 */

/** A reference at 1080x1350 is around 250KB as a data URL. Ten fit inside this. */
const MAX_IMAGE_CHARS = 4_000_000;

export const learnDesignSchema = z.object({
  name: z.string().min(1).max(60),
  ratio: z.enum(ratioEnum.enumValues),
  images: z.array(z.string().max(MAX_IMAGE_CHARS)).min(1).max(MAX_REFERENCE_IMAGES),
  instruction: z.string().max(500).optional(),
  /** The uploader's statement that these references are theirs to use. */
  rightsConfirmed: z.boolean(),
  idempotencyKey: z.string().min(1).max(200),
  /** Quote only. Nothing is written and no credits move. */
  dryRun: z.boolean(),
});

export type LearnDesignInput = z.infer<typeof learnDesignSchema>;

export const renameTemplateSchema = z.object({
  templateId: z.uuid(),
  name: z.string().min(1).max(60),
});

export type RenameTemplateInput = z.infer<typeof renameTemplateSchema>;

export const deleteTemplateSchema = z.object({ templateId: z.uuid() });

export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;
