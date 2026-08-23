'use server';

import { revalidatePath } from 'next/cache';
import { CREDIT_RATES } from '@/features/credit/estimate';
import { getBalance, spendCredits } from '@/features/credit/service';
import type { RunActionResult } from '@/features/run/actions';
import { submitRun } from '@/features/run/actions';
import { checkMargin } from '@/features/run/providerCost';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { analyzeToonFormula } from '@/lib/toon/analyze';
import { buildCharacterAnchor, seedFromName } from '@/lib/toon/character';
import { logger } from '@/libs/Logger';
import { RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import type {
  CreateCharacterInput,
  CreateToonRunInput,
  DeleteCharacterInput,
  DeleteFormulaInput,
  LearnFormulaInput,
} from '@/validations/ToonValidation';
import {
  createCharacterSchema,
  createToonRunSchema,
  deleteCharacterSchema,
  deleteFormulaSchema,
  learnFormulaSchema,
} from '@/validations/ToonValidation';
import { deleteCharacter, deleteFormula, saveCharacter, saveFormula } from './repository';

/**
 * Server Actions for instatoon.
 *
 * Two of these spend credits, and both take the same shape as everything else
 * that does: a quote first, then a charge, and nothing in between that could
 * take money from someone who has not seen the price.
 *
 * Errors cross back as a `code` rather than a thrown error. The domain layer's
 * messages name internal ids and are written for operators, so the client gets
 * the code and resolves its own translated copy.
 */

export type ToonFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input'
  | 'rights_not_confirmed'
  | 'planner_unavailable';

export type ToonQuote = { credits: number; balance: number; affordable: boolean };

export type CharacterResult =
  | { ok: true; characterId: string }
  | { ok: false; code: ToonFailureCode };

/**
 * Maps a thrown value onto a client-safe failure code.
 *
 * @param error - The caught value.
 * @returns The failure code to send back.
 */
function toFailureCode(error: unknown): ToonFailureCode {
  return error instanceof DomainError ? (error.code as ToonFailureCode) : 'invalid_input';
}

/**
 * Stores a character sheet image and returns its path.
 *
 * Unlike the formula references, this one *is* kept. It is the user's own
 * character and every future cut is drawn against it — a reference the pipeline
 * reaches for on every run cannot be something read once and dropped.
 *
 * @param orgId - Owning organization, used to namespace the path.
 * @param dataUrl - The picked image as a data URL.
 * @returns The storage path.
 * @throws Error when the data URL is malformed or the upload fails.
 */
async function storeCharacterSheet(orgId: string, dataUrl: string): Promise<string> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/u.exec(dataUrl);
  const mime = match?.[1];
  const body = match?.[2];

  if (!(mime && body)) {
    throw new Error('Character sheet must be a base64 image data URL');
  }

  // Named by content rather than by time, so re-uploading the same sheet does
  // not leave a trail of identical objects nobody will ever delete.
  const path = `${orgId}/characters/${seedFromName(body.slice(0, 512))}.jpg`;
  const bytes = await new Blob([Buffer.from(body, 'base64')]).arrayBuffer();

  await uploadObject({ bucket: RENDER_BUCKET, path, body: bytes, contentType: mime });

  return path;
}

/**
 * Creates a character.
 *
 * Free. Defining a cast costs nothing at the provider — the drawing does, and
 * that is charged per cut when a toon is actually made.
 *
 * @param input - Name, appearance, art style, and an optional sheet image.
 * @returns The new character, or a failure code.
 */
export async function createToonCharacter(input: CreateCharacterInput): Promise<CharacterResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'template:create');

    const parsed = createCharacterSchema.parse(input);
    const name = parsed.name.trim();

    const referencePath = parsed.referenceImage
      ? await storeCharacterSheet(scope.orgId, parsed.referenceImage)
      : null;

    const characterId = await saveCharacter(scope, {
      name,
      appearance: parsed.appearance,
      artStyle: parsed.artStyle,
      // Frozen here, once. Rebuilding it per run would silently change every
      // future cut the moment somebody edited one appearance field.
      anchorPrompt: buildCharacterAnchor({
        name,
        appearance: parsed.appearance,
        artStyle: parsed.artStyle,
      }),
      seed: seedFromName(name),
      referencePath,
      createdBy: scope.userId,
    });

    logger.info('Toon character created', { orgId: scope.orgId, characterId });
    revalidatePath('/dashboard/toon/characters');

    return { ok: true, characterId };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Toon character rejected', { code });

    return { ok: false, code };
  }
}

export type ToonEditResult = { ok: true } | { ok: false; code: ToonFailureCode };

/**
 * Deletes a character.
 *
 * @param input - The character to delete.
 * @returns Success, or a failure code.
 */
export async function deleteToonCharacter(input: DeleteCharacterInput): Promise<ToonEditResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'template:create');

    const parsed = deleteCharacterSchema.parse(input);
    const deleted = await deleteCharacter(scope, parsed.characterId);

    revalidatePath('/dashboard/toon/characters');

    return deleted ? { ok: true } : { ok: false, code: 'not_found' };
  } catch (error) {
    return { ok: false, code: toFailureCode(error) };
  }
}

export type LearnFormulaResult =
  | { ok: true; dryRun: true; quote: ToonQuote }
  | { ok: true; dryRun: false; formulaId: string; quote: ToonQuote; warnings: string[] }
  | { ok: false; code: ToonFailureCode };

/**
 * Quotes or runs a benchmark analysis.
 *
 * The quote cannot move: analysis is one call at one price regardless of how
 * many references are supplied, so what the dry run says is what the charge is.
 *
 * @param input - References, notes, rights confirmation, and the dry-run flag.
 * @returns The quote, or the formula that was produced.
 */
export async function learnToonFormula(input: LearnFormulaInput): Promise<LearnFormulaResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'template:create');

    const parsed = learnFormulaSchema.parse(input);
    const credits = CREDIT_RATES.toonFormula;
    const balance = await getBalance(scope);
    const quote = { credits, balance, affordable: balance >= credits };

    if (parsed.dryRun) {
      return { ok: true, dryRun: true, quote };
    }

    // Checked here rather than trusted from the form. The confirmation is the
    // record that someone said these references are theirs to study, and a
    // client that could skip it would make that record worthless.
    if (!parsed.rightsConfirmed) {
      return { ok: false, code: 'rights_not_confirmed' };
    }

    if (!quote.affordable) {
      return { ok: false, code: 'insufficient_credits' };
    }

    // Charged before the call, not after. A charge that waited for success
    // would let the same references be analyzed repeatedly for free by
    // disconnecting mid-request.
    await spendCredits(scope, {
      amount: credits,
      reason: 'spend.learn',
      idempotencyKey: parsed.idempotencyKey,
    });

    const analyzed = await analyzeToonFormula({
      images: parsed.images,
      notes: parsed.notes,
      instruction: parsed.instruction,
    });

    const margin = checkMargin({
      creditsCharged: credits,
      usage: {
        llmInputTokens: analyzed.usage.inputTokens,
        llmOutputTokens: analyzed.usage.outputTokens,
        visionImageCount: analyzed.usage.imageCount,
      },
    });

    if (!margin.healthy) {
      logger.warn('Formula analysis charged too close to what it cost', {
        orgId: scope.orgId,
        costUsd: Number(margin.costUsd.toFixed(4)),
        multiple: Number(margin.multiple.toFixed(2)),
      });
    }

    const formulaId = await saveFormula(scope, {
      name: parsed.name.trim(),
      formula: analyzed.formula,
      referenceCount: analyzed.usage.imageCount,
      createdBy: scope.userId,
    });

    logger.info('Toon formula learned', {
      orgId: scope.orgId,
      formulaId,
      warnings: analyzed.warnings.length,
    });
    revalidatePath('/dashboard/toon/formulas');

    return { ok: true, dryRun: false, formulaId, quote, warnings: analyzed.warnings };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Formula analysis rejected', { code });

    return { ok: false, code };
  }
}

/**
 * Deletes a formula.
 *
 * @param input - The formula to delete.
 * @returns Success, or a failure code.
 */
export async function deleteToonFormula(input: DeleteFormulaInput): Promise<ToonEditResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'template:create');

    const parsed = deleteFormulaSchema.parse(input);
    const deleted = await deleteFormula(scope, parsed.formulaId);

    revalidatePath('/dashboard/toon/formulas');

    return deleted ? { ok: true } : { ok: false, code: 'not_found' };
  } catch (error) {
    return { ok: false, code: toFailureCode(error) };
  }
}

/**
 * Quotes or starts one instatoon.
 *
 * Delegates to `submitRun` rather than charging here. Everything an instatoon
 * needs after the storyboard — the dry-run quote, the idempotent charge, the
 * queue hand-off, the refund on partial failure — already exists on the run
 * path, and a second charging path would be a second place for the invariant
 * "a charge always buys either the cards or a refund" to break.
 *
 * @param input - Topic, character, formula, cut count, ratio, and dry-run flag.
 * @returns The estimate, the started run, or a failure code.
 */
export async function submitToonRun(input: CreateToonRunInput): Promise<RunActionResult> {
  const parsed = createToonRunSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, code: 'invalid_input' };
  }

  const request = parsed.data;

  return await submitRun({
    items: [
      {
        topic: request.topic,
        mode: 'toon',
        toon: {
          characterId: request.characterId,
          formulaId: request.formulaId,
          cutCount: request.cutCount,
        },
        // One channel for now. Fan-out across ratios reuses the drawn art and
        // is priced as a derived cut, but the picker for it belongs with the
        // board rather than on the single-toon screen.
        targets: [{ channel: 'instagram', ratio: request.ratio, isOrigin: true }],
      },
    ],
    scope: { kind: 'full' },
    idempotencyKey: request.idempotencyKey,
    dryRun: request.dryRun,
  });
}
