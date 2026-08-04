import { describe, expect, it } from 'vitest';
import { CREDIT_RATES } from '@/features/credit/estimate';
import { checkMargin, providerCostUsd } from './providerCost';

/**
 * The pricing floor.
 *
 * These numbers decide whether the product makes money on every run it sells,
 * so they are asserted rather than eyeballed. A rate change should break a test
 * here and be looked at, not pass quietly.
 */

/** What one card news actually spends on the planning call, roughly. */
const ONE_DECK = { llmInputTokens: 2000, llmOutputTokens: 2000 };

describe(providerCostUsd, () => {
  it('prices input and output at their separate rates', () => {
    expect(providerCostUsd({ llmInputTokens: 1_000_000, llmOutputTokens: 0 })).toBeCloseTo(3, 5);
    expect(providerCostUsd({ llmInputTokens: 0, llmOutputTokens: 1_000_000 })).toBeCloseTo(15, 5);
  });

  // Ten reference images are about 19,000 tokens. Left uncounted, design
  // learning would look free and be priced as though it were.
  it('counts images sent to the model as input tokens', () => {
    const withImages = providerCostUsd({ ...ONE_DECK, visionImageCount: 10 });
    const withoutImages = providerCostUsd(ONE_DECK);

    expect(withImages).toBeGreaterThan(withoutImages);
    expect(withImages - withoutImages).toBeCloseTo((10 * 1944 * 3) / 1_000_000, 6);
  });

  it('costs nothing when nothing was spent', () => {
    expect(providerCostUsd({ llmInputTokens: 0, llmOutputTokens: 0 })).toBe(0);
  });
});

describe(checkMargin, () => {
  // 15 credits is 75 cents against about 3.6 cents of model time.
  it('clears the floor on a full card news at fifteen credits', () => {
    const margin = checkMargin({ creditsCharged: 15, usage: ONE_DECK });

    expect(margin.chargedUsd).toBeCloseTo(0.75, 5);
    expect(margin.healthy).toBeTruthy();
  });

  // Design learning reads ten images. This is the case that set its price: at
  // five credits it cleared cost by 2.5x and did not survive this assertion.
  it('clears on design learning with ten reference images', () => {
    const margin = checkMargin({
      creditsCharged: CREDIT_RATES.designLearning,
      usage: { llmInputTokens: 1500, llmOutputTokens: 2500, visionImageCount: 10 },
    });

    expect(margin.healthy).toBeTruthy();
  });

  it('would not clear on design learning at half that price', () => {
    const margin = checkMargin({
      creditsCharged: CREDIT_RATES.designLearning / 2,
      usage: { llmInputTokens: 1500, llmOutputTokens: 2500, visionImageCount: 10 },
    });

    expect(margin.healthy).toBeFalsy();
  });

  it('reports an unhealthy margin when a run spends more than it charges', () => {
    const margin = checkMargin({
      creditsCharged: 1,
      usage: { llmInputTokens: 200_000, llmOutputTokens: 50_000 },
    });

    expect(margin.multiple).toBeLessThan(1);
    expect(margin.healthy).toBeFalsy();
  });

  it('treats a run that spent nothing as infinitely profitable', () => {
    const margin = checkMargin({
      creditsCharged: 5,
      usage: { llmInputTokens: 0, llmOutputTokens: 0 },
    });

    expect(margin.multiple).toBe(Number.POSITIVE_INFINITY);
    expect(margin.healthy).toBeTruthy();
  });
});
