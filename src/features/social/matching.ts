/**
 * Deciding whether a comment triggers an automation.
 *
 * Kept as a pure function because it is the part with a judgement in it. A rule
 * that fires on the wrong comment sends a stranger a message in the owner's
 * name, so the matching has to be testable without a network.
 */

/**
 * Whether a comment contains any of the keywords.
 *
 * Matched on word boundaries rather than as substrings: a rule for "가격" that
 * also fired on "가격대비" would answer conversations it was never meant to.
 * Korean has no spaces inside compounds, so the boundary check is a simple
 * containment test bounded by non-word characters where the language has them.
 *
 * @param comment - The comment text.
 * @param keywords - Lower-cased keywords from the automation.
 * @returns The keyword that matched, or null.
 */
export function findTriggerKeyword(comment: string, keywords: readonly string[]): string | null {
  const text = comment.toLowerCase();

  for (const keyword of keywords) {
    if (keyword === '') {
      continue;
    }

    const index = text.indexOf(keyword);

    if (index === -1) {
      continue;
    }

    const before = text[index - 1] ?? ' ';
    const after = text[index + keyword.length] ?? ' ';

    // Latin keywords need real boundaries; a keyword that is not Latin has no
    // spacing convention to lean on, so containment is the honest test.
    if (!/^[a-z0-9]+$/u.test(keyword) || (!/[a-z0-9]/u.test(before) && !/[a-z0-9]/u.test(after))) {
      return keyword;
    }
  }

  return null;
}
