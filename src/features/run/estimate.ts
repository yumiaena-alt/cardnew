import { CREDIT_RATES } from '@/features/credit/estimate';
import type {
  CreateRunInput,
  RunItemInput,
  RunScopeInput,
  RunToonSpecInput,
} from '@/validations/RunValidation';

/**
 * What one run will cost, broken down per cut.
 *
 * The dry-run quote and the real charge are produced by this same function, so
 * the number the user accepts is by construction the number they are billed.
 */

/** One generated cut, priced. Becomes exactly one `run_items` row. */
type RunCutEstimate = {
  itemIndex: number;
  topic: string;
  channel: RunItemInput['targets'][number]['channel'];
  ratio: RunItemInput['targets'][number]['ratio'];
  isOrigin: boolean;
  /** What this cut produces. Drives which rate applies. */
  mode: NonNullable<RunItemInput['mode']>;
  /** Instatoon inputs, carried onto the item so a retry does not re-read them. */
  toon?: RunToonSpecInput;
  credits: number;
  sourceRowId?: string;
  /** Set for a partial regeneration: the deck being repainted. */
  deckId?: string;
  /** Target-level pin wins over the item-level one; both may be absent. */
  templateVersionId?: string;
};

export type RunEstimate = {
  cuts: RunCutEstimate[];
  originCount: number;
  cutCount: number;
  /** Credits the run will charge, and the number the dry-run quote shows. */
  total: number;
};

/**
 * Prices one cut.
 *
 * A partial regeneration is priced by how much of the deck it touches and not
 * by channel: re-running one slot costs the same whether it sits in the origin
 * or in a derived cut, because the work is identical.
 *
 * A full instatoon is priced by its length, not as one flat deck. Every cut is
 * a drawn panel that costs real money at the provider, so a nine-cut story and
 * a four-cut one are not the same purchase — pricing them alike would either
 * overcharge the short one or sell the long one below cost.
 *
 * @param input - Regeneration scope, whether this is the origin, and the mode.
 * @returns The credits this cut costs.
 */
function priceCut(input: {
  scope: RunScopeInput;
  isOrigin: boolean;
  mode: NonNullable<RunItemInput['mode']>;
  toon?: RunToonSpecInput;
}): number {
  if (input.scope.kind === 'panel') {
    return CREDIT_RATES.panel;
  }

  if (input.scope.kind === 'slot') {
    return CREDIT_RATES.slot;
  }

  if (input.mode === 'toon') {
    // A derived instatoon re-lays art that already exists, so it draws nothing.
    if (!input.isOrigin) {
      return CREDIT_RATES.toonDerivedCut;
    }

    // Falls back to the base alone rather than throwing: validation already
    // requires the spec on a toon item, and a quote is not the place to fail.
    const cutCount = input.toon?.cutCount ?? 0;

    return CREDIT_RATES.toonBase + cutCount * CREDIT_RATES.toonCut;
  }

  return input.isOrigin ? CREDIT_RATES.originDeck : CREDIT_RATES.derivedCut;
}

/**
 * Estimates the credits a run would cost, one entry per cut it will produce.
 *
 * @param input - Validated run input; only `items` and `scope` are read.
 * @returns The per-cut breakdown and the total the run will charge.
 */
export function estimateRun(input: Pick<CreateRunInput, 'items' | 'scope'>): RunEstimate {
  const cuts: RunCutEstimate[] = [];

  for (const [itemIndex, item] of input.items.entries()) {
    // Absent means card news. Resolved once here so the rate lookup and the
    // stored row cannot disagree about what an item without a mode is.
    const mode = item.mode ?? 'cardnews';

    for (const target of item.targets) {
      cuts.push({
        itemIndex,
        topic: item.topic,
        channel: target.channel,
        ratio: target.ratio,
        isOrigin: target.isOrigin,
        mode,
        ...(item.toon ? { toon: item.toon } : {}),
        credits: priceCut({
          scope: input.scope,
          isOrigin: target.isOrigin,
          mode,
          ...(item.toon ? { toon: item.toon } : {}),
        }),
        sourceRowId: item.sourceRowId,
        deckId: item.deckId,
        templateVersionId: target.templateVersionId ?? item.templateVersionId,
      });
    }
  }

  const originCount = cuts.filter((cut) => cut.isOrigin).length;

  return {
    cuts,
    originCount,
    cutCount: cuts.length - originCount,
    total: cuts.reduce((sum, cut) => sum + cut.credits, 0),
  };
}
