/**
 * What a run actually cost us, in dollars.
 *
 * Credits only work as a business if what they charge exceeds what the run
 * spends. That comparison was impossible to make: the cost column existed and
 * nothing ever wrote a number into it, so every run on record cost zero.
 *
 * The rates here are list prices and will drift. They are constants in one file
 * rather than scattered multipliers so that correcting them is one edit.
 */

/** USD per million tokens, as published for the planning model. */
const RATE_PER_MTOK = {
  input: 3,
  output: 15,
} as const;

const TOKENS_PER_MILLION = 1_000_000;

/**
 * Tokens one image costs the model, by Anthropic's width × height / 750 rule.
 *
 * A reference image at 1080×1350 is roughly 1,944 tokens, so ten of them are a
 * real cost rather than a rounding error — which is the whole reason design
 * learning cannot be priced by feel.
 */
const TOKENS_PER_IMAGE = 1944;

export type RunUsage = {
  llmInputTokens: number;
  llmOutputTokens: number;
  /** Images sent to the model, not cards rendered. Rendering costs no tokens. */
  visionImageCount?: number;
};

/**
 * Converts measured usage into dollars.
 *
 * @param usage - Tokens spent, and any images sent to the model.
 * @returns The provider cost in USD.
 */
export function providerCostUsd(usage: RunUsage): number {
  const visionTokens = (usage.visionImageCount ?? 0) * TOKENS_PER_IMAGE;
  const inputCost =
    ((usage.llmInputTokens + visionTokens) * RATE_PER_MTOK.input) / TOKENS_PER_MILLION;
  const outputCost = (usage.llmOutputTokens * RATE_PER_MTOK.output) / TOKENS_PER_MILLION;

  return inputCost + outputCost;
}

/** What one credit is sold for, in USD. Matches `overage_cents_per_credit`. */
const CREDIT_VALUE_USD = 0.05;

/**
 * The margin below which a price is no longer worth charging.
 *
 * Three times cost, not a hair above it: the rates here cover the model only.
 * The render host, storage, bandwidth and the failures that get refunded are
 * all real and none of them are counted, so a run that clears list price by a
 * few percent is not actually clearing anything.
 */
const MIN_MARGIN_MULTIPLE = 3;

export type MarginCheck = {
  costUsd: number;
  chargedUsd: number;
  /** How many times over the provider cost the charge is. Infinite when free. */
  multiple: number;
  healthy: boolean;
};

/**
 * Compares what a run charged against what it cost.
 *
 * @param input - Credits charged and the usage the run recorded.
 * @returns The comparison, and whether the margin clears the floor.
 */
export function checkMargin(input: { creditsCharged: number; usage: RunUsage }): MarginCheck {
  const costUsd = providerCostUsd(input.usage);
  const chargedUsd = input.creditsCharged * CREDIT_VALUE_USD;
  const multiple = costUsd === 0 ? Number.POSITIVE_INFINITY : chargedUsd / costUsd;

  return {
    costUsd,
    chargedUsd,
    multiple,
    healthy: multiple >= MIN_MARGIN_MULTIPLE,
  };
}
