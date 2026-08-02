import * as z from 'zod';
import { channelEnum, ratioEnum } from '@/models/Enums';

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

const runItemSchema = z.object({
  topic: z.string().min(1).max(500),
  templateVersionId: z.uuid(),
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

export const createRunSchema = z.object({
  items: z.array(runItemSchema).min(1).max(MAX_RUN_ITEMS),
  scope: runScopeSchema,
  /** Board the run came from, when it was started from the sheet. */
  boardId: z.uuid().optional(),
  idempotencyKey: z.string().min(1).max(200),
  /** Quote only. Nothing is written and no credits move. */
  dryRun: z.boolean(),
});

export type RunItemInput = z.infer<typeof runItemSchema>;
export type RunScopeInput = z.infer<typeof runScopeSchema>;
export type CreateRunInput = z.infer<typeof createRunSchema>;
