import { CREDIT_RATES } from '@/features/credit/estimate';
import type { CreateRunInput, RunItemInput, RunScopeInput } from '@/validations/RunValidation';

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
  credits: number;
  sourceRowId?: string;
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
 * @param scope - How much of the deck the run regenerates.
 * @param isOrigin - Whether this cut is the source the others derive from.
 * @returns The credits this cut costs.
 */
function priceCut(scope: RunScopeInput, isOrigin: boolean): number {
  if (scope.kind === 'panel') {
    return CREDIT_RATES.panel;
  }

  if (scope.kind === 'slot') {
    return CREDIT_RATES.slot;
  }

  return isOrigin ? CREDIT_RATES.originDeck : CREDIT_RATES.derivedCut;
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
    for (const target of item.targets) {
      cuts.push({
        itemIndex,
        topic: item.topic,
        channel: target.channel,
        ratio: target.ratio,
        isOrigin: target.isOrigin,
        credits: priceCut(input.scope, target.isOrigin),
        sourceRowId: item.sourceRowId,
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
