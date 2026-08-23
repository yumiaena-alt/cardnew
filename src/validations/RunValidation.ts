import * as z from 'zod';
import { MAX_TOON_CUTS, MIN_TOON_CUTS } from '@/lib/toon/schema';
import { channelEnum, ratioEnum, runModeEnum } from '@/models/Enums';

/**
 * Zod schemas for the generation run entry point.
 *
 * A run is the only thing that spends credits, so its input is parsed rather
 * than trusted even though the caller is our own Server Action. The enum values
 * come from the Drizzle enums so a channel added to the database cannot drift
 * out of sync with what the API accepts.
 */

const fanoutTargetSchema = z.object({
  channel: z.enum(channelEnum.enumValues),
  ratio: z.enum(ratioEnum.enumValues),
  templateVersionId: z.uuid().optional(),
  isOrigin: z.boolean(),
});

/**
 * The instatoon inputs an item carries.
 *
 * The cut count is required rather than derived from the formula: it is what
 * the run is priced by, and a quote that read it back from a formula the user
 * could edit in another tab would not be the number they get billed.
 */
const toonSpecSchema = z.object({
  characterId: z.uuid(),
  formulaId: z.uuid().nullable().default(null),
  cutCount: z.number().int().min(MIN_TOON_CUTS).max(MAX_TOON_CUTS),
});

const runItemSchema = z
  .object({
    topic: z.string().min(1).max(500),
    /**
     * What this item produces. Absent means card news.
     *
     * Left optional rather than defaulted so the callers that predate instatoon —
     * the board, the deck form, the link importer — keep passing exactly what
     * they always passed. A default would make the field required on the parsed
     * type and force a `mode: 'cardnews'` onto every one of them.
     */
    mode: z.enum(runModeEnum.enumValues).optional(),
    /** Required for `toon`, refused for `cardnews`. Enforced on the object below. */
    toon: toonSpecSchema.optional(),
    /**
     * Pins a template. Left out, the template engine picks one from the topic —
     * that is how `lib/renderer/compose` already works, so requiring a pinned id
     * would block every caller that has not built a template picker yet.
     */
    templateVersionId: z.uuid().optional(),
    /**
     * Channels this item expands into. The data model requires a channel per
     * generated cut, so the origin is an explicit target rather than implied by an
     * empty list.
     */
    targets: z
      .array(fanoutTargetSchema)
      .min(1)
      .refine((targets) => targets.filter((target) => target.isOrigin).length === 1, {
        message: 'Exactly one target must be the origin',
      }),
    /** Set when the run was started from a row of the monthly board. */
    sourceRowId: z.uuid().optional(),
    /**
     * The deck being regenerated. Required for a partial scope and absent for a
     * full one: a repaint edits an existing deck, while a full run makes a new
     * one, and the two must not be confusable.
     */
    deckId: z.uuid().optional(),
  })
  .refine((item) => item.mode !== 'toon' || item.toon !== undefined, {
    message: 'An instatoon item must name its character and cut count',
  })
  .refine((item) => item.mode === 'toon' || item.toon === undefined, {
    message: 'A card news item cannot carry instatoon inputs',
  });

const runScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('full') }),
  z.object({ kind: z.literal('panel'), panelIndex: z.number().int().min(0) }),
  z.object({
    kind: z.literal('slot'),
    panelIndex: z.number().int().min(0),
    slotKey: z.string().min(1),
  }),
]);

/** Upper bound on one run. A monthly board is the largest realistic batch. */
const MAX_RUN_ITEMS = 50;

export const createRunSchema = z
  .object({
    items: z.array(runItemSchema).min(1).max(MAX_RUN_ITEMS),
    scope: runScopeSchema,
    /** Board the run came from, when it was started from the sheet. */
    boardId: z.uuid().optional(),
    idempotencyKey: z.string().min(1).max(200),
    /** Quote only. Nothing is written and no credits move. */
    dryRun: z.boolean(),
  })
  .refine(
    (input) =>
      input.scope.kind === 'full' || input.items.every((item) => item.deckId !== undefined),
    { message: 'A partial regeneration must name the deck it edits' },
  );

export type RunItemInput = z.infer<typeof runItemSchema>;
export type RunToonSpecInput = z.infer<typeof toonSpecSchema>;
export type RunScopeInput = z.infer<typeof runScopeSchema>;
export type CreateRunInput = z.infer<typeof createRunSchema>;
