import type { BrandStyle } from '@/lib/renderer/types';

/**
 * A learned template's tokens, as the composer wants them.
 *
 * Learning writes loose strings because that is what a model returns. The
 * composer wants a palette and numeric weights, and the gap between the two is
 * this file — put anywhere else, every caller would parse the same strings
 * slightly differently.
 */

/** Weights outside this are not real font weights, whatever the model said. */
const MIN_WEIGHT = 100;
const MAX_WEIGHT = 900;

/**
 * Reads a font weight out of a token.
 *
 * @param value - The token, which a model wrote as a string.
 * @returns The weight, or undefined when it is not one.
 */
function toWeight(value: string | undefined): number | undefined {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < MIN_WEIGHT || parsed > MAX_WEIGHT) {
    return undefined;
  }

  return Math.round(parsed / 100) * 100;
}

/**
 * Keeps a colour only when it is one.
 *
 * A token that is not a hex colour is dropped rather than passed through: the
 * composer would set it as a CSS value, and an unparseable colour there does
 * not fail, it silently renders as black text on a black card.
 *
 * @param value - The token.
 * @returns The colour, or undefined.
 */
function toColor(value: string | undefined): string | undefined {
  return value !== undefined && /^#[\da-f]{3,8}$/iu.test(value.trim()) ? value.trim() : undefined;
}

/**
 * Turns learned tokens into a brand style.
 *
 * @param tokens - The tokens stored on a template version.
 * @returns The style the composer applies.
 */
export function toBrandStyle(tokens: Record<string, string>): BrandStyle {
  return {
    palette: {
      ...(toColor(tokens.backgroundColor) ? { background: toColor(tokens.backgroundColor) } : {}),
      ...(toColor(tokens.textColor) ? { text: toColor(tokens.textColor) } : {}),
      ...(toColor(tokens.accentColor) ? { accent: toColor(tokens.accentColor) } : {}),
    },
    typography: {
      ...(toWeight(tokens.headlineWeight)
        ? { headingWeight: toWeight(tokens.headlineWeight) }
        : {}),
      ...(toWeight(tokens.bodyWeight) ? { bodyWeight: toWeight(tokens.bodyWeight) } : {}),
    },
    logo: null,
  };
}
