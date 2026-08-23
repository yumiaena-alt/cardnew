import { desc, eq } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import type { StoryFormula, ToonStoryboard as StoryboardDoc } from '@/lib/toon/schema';
import { storyFormulaSchema } from '@/lib/toon/schema';
import { db } from '@/libs/DB';
import type { Ratio } from '@/models/Enums';
import type { ArtStyle, ToonAppearance, ToonCharacter, ToonFormula } from '@/models/Toon';
import { toonCharacters, toonFormulas, toonStoryboards } from '@/models/Toon';

/**
 * Storage for instatoon characters, formulas and storyboards.
 *
 * Every read is tenant-filtered through `orgScoped()` even when the caller
 * already holds the id. A character id travels on a run item, which means it
 * arrives from a client — and one organization drawing with another's
 * character would be the same class of leak as generating in their brand.
 */

/** A cast, not an archive. A solo operator runs one or two leads. */
const CHARACTER_LIMIT = 30;
/** Formulas are picked from a list every time a toon is made. Keep it readable. */
const FORMULA_LIMIT = 30;

export type SaveCharacterInput = {
  name: string;
  appearance: ToonAppearance;
  artStyle: ArtStyle;
  anchorPrompt: string;
  seed: number;
  referencePath: string | null;
  createdBy: string;
};

/**
 * Writes a character.
 *
 * @param scope - Tenant scope.
 * @param input - Name, appearance, frozen anchor, seed, and reference path.
 * @returns The new character's id.
 * @throws Error when the insert returns nothing.
 */
export async function saveCharacter(scope: OrgScope, input: SaveCharacterInput): Promise<string> {
  const [row] = await db
    .insert(toonCharacters)
    .values({ ...input, orgId: scope.orgId })
    .returning({ id: toonCharacters.id });

  if (!row) {
    throw new Error('Character insert returned nothing');
  }

  return row.id;
}

/**
 * Lists this organization's characters, newest first.
 *
 * @param scope - Tenant scope.
 * @returns The characters.
 */
export async function listCharacters(scope: OrgScope): Promise<ToonCharacter[]> {
  return await db
    .select()
    .from(toonCharacters)
    .where(orgScoped(scope, toonCharacters))
    .orderBy(desc(toonCharacters.createdAt))
    .limit(CHARACTER_LIMIT);
}

/**
 * Reads one character inside the caller's organization.
 *
 * @param scope - Tenant scope.
 * @param characterId - Character named by the run item.
 * @returns The character, or null when it is not the caller's.
 */
export async function findCharacter(
  scope: OrgScope,
  characterId: string,
): Promise<ToonCharacter | null> {
  const [row] = await db
    .select()
    .from(toonCharacters)
    .where(orgScoped(scope, toonCharacters, eq(toonCharacters.id, characterId)))
    .limit(1);

  return row ?? null;
}

/**
 * Deletes a character.
 *
 * The toons it already drew are untouched — a deck holds its own rendered
 * panels and documents. What is lost is the ability to draw more of them.
 *
 * @param scope - Tenant scope.
 * @param characterId - Character to delete.
 * @returns Whether it was the caller's to delete.
 */
export async function deleteCharacter(scope: OrgScope, characterId: string): Promise<boolean> {
  const rows = await db
    .delete(toonCharacters)
    .where(orgScoped(scope, toonCharacters, eq(toonCharacters.id, characterId)))
    .returning({ id: toonCharacters.id });

  return rows.length > 0;
}

export type SaveFormulaInput = {
  name: string;
  formula: StoryFormula;
  referenceCount: number;
  createdBy: string;
};

/**
 * Writes an analyzed formula together with the rights confirmation behind it.
 *
 * The two are written in one statement on purpose: a formula with no record of
 * who confirmed the references is exactly the record the confirmation exists to
 * produce, missing.
 *
 * @param scope - Tenant scope.
 * @param input - The formula, how many references produced it, and the author.
 * @returns The new formula's id.
 * @throws Error when the insert returns nothing.
 */
export async function saveFormula(scope: OrgScope, input: SaveFormulaInput): Promise<string> {
  const [row] = await db
    .insert(toonFormulas)
    .values({
      orgId: scope.orgId,
      name: input.name,
      source: 'learned',
      beats: input.formula.beats,
      hookPatterns: input.formula.hookPatterns,
      toneTags: input.formula.toneTags,
      pacing: input.formula.pacing,
      summary: input.formula.summary,
      referenceCount: input.referenceCount,
      rightsConfirmedAt: new Date(),
      createdBy: input.createdBy,
    })
    .returning({ id: toonFormulas.id });

  if (!row) {
    throw new Error('Formula insert returned nothing');
  }

  return row.id;
}

/**
 * Lists this organization's formulas, newest first.
 *
 * @param scope - Tenant scope.
 * @returns The formulas.
 */
export async function listFormulas(scope: OrgScope): Promise<ToonFormula[]> {
  return await db
    .select()
    .from(toonFormulas)
    .where(orgScoped(scope, toonFormulas))
    .orderBy(desc(toonFormulas.createdAt))
    .limit(FORMULA_LIMIT);
}

/**
 * Reads one formula inside the caller's organization, shaped for the generator.
 *
 * Returns the library type rather than the row: the storyboard prompt should
 * not have to know that `pacing` is stored as loose text because Postgres
 * enums are expensive to extend later.
 *
 * @param scope - Tenant scope.
 * @param formulaId - Formula named by the run item.
 * @returns The formula, or null when it is not the caller's.
 */
export async function findFormula(
  scope: OrgScope,
  formulaId: string,
): Promise<StoryFormula | null> {
  const [row] = await db
    .select()
    .from(toonFormulas)
    .where(orgScoped(scope, toonFormulas, eq(toonFormulas.id, formulaId)))
    .limit(1);

  if (!row) {
    return null;
  }

  // Parsed rather than cast. `beats` and `pacing` are loose jsonb and text on
  // the way out of Postgres, and a row written by an older shape of this
  // feature should fail here rather than reach the prompt as something the
  // storyboard generator cannot read.
  return storyFormulaSchema.parse({
    beats: row.beats,
    hookPatterns: row.hookPatterns,
    toneTags: row.toneTags,
    pacing: row.pacing,
    summary: row.summary,
  });
}

/**
 * Deletes a formula.
 *
 * @param scope - Tenant scope.
 * @param formulaId - Formula to delete.
 * @returns Whether it was the caller's to delete.
 */
export async function deleteFormula(scope: OrgScope, formulaId: string): Promise<boolean> {
  const rows = await db
    .delete(toonFormulas)
    .where(orgScoped(scope, toonFormulas, eq(toonFormulas.id, formulaId)))
    .returning({ id: toonFormulas.id });

  return rows.length > 0;
}

export type SaveStoryboardInput = {
  deckId: string | null;
  characterId: string;
  formulaId: string | null;
  topic: string;
  ratio: Ratio;
  storyboard: StoryboardDoc;
  warnings: string[];
};

/**
 * Writes the storyboard a deck was drawn from.
 *
 * Stored even though the panels already exist, because the panels hold the
 * *result* and this holds the *instruction*. Redrawing one cut needs the
 * instruction, and it cannot be recovered from a rendered image.
 *
 * @param scope - Tenant scope.
 * @param input - The deck, its inputs, and the storyboard itself.
 * @returns The new storyboard's id.
 * @throws Error when the insert returns nothing.
 */
export async function saveStoryboard(scope: OrgScope, input: SaveStoryboardInput): Promise<string> {
  const [row] = await db
    .insert(toonStoryboards)
    .values({
      orgId: scope.orgId,
      deckId: input.deckId,
      characterId: input.characterId,
      formulaId: input.formulaId,
      topic: input.topic,
      ratio: input.ratio,
      hook: input.storyboard.hook,
      logline: input.storyboard.logline,
      cuts: input.storyboard.cuts,
      caption: input.storyboard.caption,
      hashtags: input.storyboard.hashtags,
      warnings: input.warnings,
    })
    .returning({ id: toonStoryboards.id });

  if (!row) {
    throw new Error('Storyboard insert returned nothing');
  }

  return row.id;
}
