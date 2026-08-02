import { describe, expect, it } from 'vitest';
import { CREDIT_RATES, estimateBoardCredits } from './estimate';

describe(estimateBoardCredits, () => {
  it('charges the origin rate for a single channel', () => {
    const result = estimateBoardCredits([{ hasTopic: true, channelCount: 1 }]);

    expect(result.total).toBe(CREDIT_RATES.originDeck);
    expect(result.cutCount).toBe(0);
  });

  it('charges the cut rate for every channel past the first', () => {
    const result = estimateBoardCredits([{ hasTopic: true, channelCount: 3 }]);

    expect(result.originCount).toBe(1);
    expect(result.cutCount).toBe(2);
    expect(result.total).toBe(CREDIT_RATES.originDeck + 2 * CREDIT_RATES.derivedCut);
  });

  it('skips rows without a topic', () => {
    const result = estimateBoardCredits([
      { hasTopic: false, channelCount: 3 },
      { hasTopic: true, channelCount: 1 },
    ]);

    expect(result.rowCount).toBe(1);
    expect(result.total).toBe(CREDIT_RATES.originDeck);
  });

  it('skips rows with no channel selected', () => {
    const result = estimateBoardCredits([{ hasTopic: true, channelCount: 0 }]);

    expect(result.rowCount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('matches the PRD monthly scenario of twelve topics across three channels', () => {
    const rows = Array.from({ length: 12 }, () => ({ hasTopic: true, channelCount: 3 }));

    expect(estimateBoardCredits(rows).total).toBe(300);
  });

  it('returns zero for an empty board', () => {
    expect(estimateBoardCredits([]).total).toBe(0);
  });
});
