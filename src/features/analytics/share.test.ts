import { describe, expect, it } from 'vitest';
import { toChannelShares } from './share';

describe(toChannelShares, () => {
  it('gives the largest channel a full bar', () => {
    const shares = toChannelShares([
      { channel: 'instagram', count: 8 },
      { channel: 'threads', count: 2 },
    ]);

    expect(shares[0]).toStrictEqual({ channel: 'instagram', count: 8, percent: 100 });
  });

  // Measured against the leader, not the total: across five channels a
  // total-based bar leaves every one of them too short to compare.
  it('scales the rest against the leader rather than the total', () => {
    const shares = toChannelShares([
      { channel: 'instagram', count: 8 },
      { channel: 'threads', count: 2 },
    ]);

    expect(shares[1]?.percent).toBe(25);
  });

  it('sorts largest first regardless of input order', () => {
    const shares = toChannelShares([
      { channel: 'blog', count: 1 },
      { channel: 'instagram', count: 9 },
      { channel: 'tiktok', count: 4 },
    ]);

    expect(shares.map((share) => share.channel)).toStrictEqual(['instagram', 'tiktok', 'blog']);
  });

  it('returns nothing for no channels', () => {
    expect(toChannelShares([])).toStrictEqual([]);
  });

  // Dividing by the leader is a division by zero when nothing has been made.
  it('reports zero rather than NaN when every count is zero', () => {
    const shares = toChannelShares([{ channel: 'instagram', count: 0 }]);

    expect(shares[0]?.percent).toBe(0);
  });

  it('leaves the input untouched', () => {
    const input = [
      { channel: 'blog', count: 1 },
      { channel: 'instagram', count: 9 },
    ];

    toChannelShares(input);

    expect(input[0]?.channel).toBe('blog');
  });
});
