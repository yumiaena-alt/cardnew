import { describe, expect, it } from 'vitest';
import { toBrandStyle } from './brand';

/**
 * Learned tokens reaching the composer.
 *
 * The model writes these, so they are not trusted to be well formed. A bad
 * colour that gets through does not throw — it renders as black text on a
 * black card, which looks like a design decision.
 */

describe(toBrandStyle, () => {
  it('carries colours and weights through', () => {
    const style = toBrandStyle({
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      accentColor: '#ff6b35',
      headlineWeight: '700',
      bodyWeight: '400',
    });

    expect(style.palette).toStrictEqual({
      background: '#1a1a1a',
      text: '#ffffff',
      accent: '#ff6b35',
    });
    expect(style.typography).toStrictEqual({ headingWeight: 700, bodyWeight: 400 });
  });

  it('drops anything that is not a colour', () => {
    const style = toBrandStyle({ backgroundColor: 'dark navy', textColor: '#fff' });

    expect(style.palette).toStrictEqual({ text: '#fff' });
  });

  // 650 is not a weight any font has. Rounding beats refusing: the design it
  // came from is still mostly right.
  it('rounds a weight to the nearest hundred', () => {
    expect(toBrandStyle({ headlineWeight: '650' }).typography.headingWeight).toBe(700);
  });

  it('ignores a weight outside the real range', () => {
    expect(toBrandStyle({ headlineWeight: '1400' }).typography.headingWeight).toBeUndefined();
    expect(toBrandStyle({ bodyWeight: 'bold' }).typography.bodyWeight).toBeUndefined();
  });

  it('returns an empty style when nothing was learned', () => {
    expect(toBrandStyle({})).toStrictEqual({ palette: {}, typography: {}, logo: null });
  });
});
