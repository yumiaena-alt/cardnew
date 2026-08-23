import * as z from 'zod';
import { MAX_FORMULA_REFERENCES } from '@/lib/toon/analyze';
import { artStyleSchema, characterAppearanceSchema } from '@/lib/toon/character';
import { MAX_TOON_CUTS, MIN_TOON_CUTS } from '@/lib/toon/schema';
import { ratioEnum } from '@/models/Enums';

/**
 * Zod schemas for the instatoon surfaces.
 *
 * Reference images arrive as data URLs and are never stored, for the same
 * reason design learning does not store them: they are read once to extract a
 * structure, and keeping someone else's comic because the pipeline happened to
 * pass through storage would be holding it for no reason anyone could name.
 */

/** A 1080x1350 reference is around 250KB as a data URL. Ten fit inside this. */
const MAX_IMAGE_CHARS = 4_000_000;

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(40),
  appearance: characterAppearanceSchema,
  artStyle: artStyleSchema,
  /**
   * Character sheet image. Optional, and the strongest consistency lever there
   * is — without it the pipeline still holds the character with the anchor
   * sentence and a fixed seed, just less tightly.
   */
  referenceImage: z.string().max(MAX_IMAGE_CHARS).nullable().default(null),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

export const deleteCharacterSchema = z.object({ characterId: z.uuid() });

export type DeleteCharacterInput = z.infer<typeof deleteCharacterSchema>;

export const learnFormulaSchema = z.object({
  name: z.string().min(1).max(60),
  images: z.array(z.string().max(MAX_IMAGE_CHARS)).min(1).max(MAX_FORMULA_REFERENCES),
  /** Captions or notes that came with the references. */
  notes: z.string().max(2000).nullable().default(null),
  instruction: z.string().max(500).nullable().default(null),
  /** The analyst's statement that these references are theirs to study. */
  rightsConfirmed: z.boolean(),
  idempotencyKey: z.string().min(1).max(200),
  /** Quote only. Nothing is written and no credits move. */
  dryRun: z.boolean(),
});

export type LearnFormulaInput = z.infer<typeof learnFormulaSchema>;

export const deleteFormulaSchema = z.object({ formulaId: z.uuid() });

export type DeleteFormulaInput = z.infer<typeof deleteFormulaSchema>;

export const createToonRunSchema = z.object({
  topic: z.string().min(1).max(500),
  characterId: z.uuid(),
  formulaId: z.uuid().nullable().default(null),
  cutCount: z.number().int().min(MIN_TOON_CUTS).max(MAX_TOON_CUTS),
  ratio: z.enum(ratioEnum.enumValues),
  idempotencyKey: z.string().min(1).max(200),
  dryRun: z.boolean(),
});

export type CreateToonRunInput = z.infer<typeof createToonRunSchema>;
