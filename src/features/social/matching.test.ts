import { describe, expect, it } from 'vitest';
import { findTriggerKeyword } from './matching';

// A false positive here sends a stranger a message in the owner's name, so the
// cases below are about what must NOT fire as much as what must.
describe(findTriggerKeyword, () => {
  describe('matching', () => {
    it('finds a keyword in the comment', () => {
      expect(findTriggerKeyword('가격 알려주세요', ['가격'])).toBe('가격');
    });

    it('ignores case', () => {
      expect(findTriggerKeyword('Send me the PRICE', ['price'])).toBe('price');
    });

    it('returns the first keyword that matches', () => {
      expect(findTriggerKeyword('배송이랑 가격 문의', ['가격', '배송'])).toBe('가격');
    });

    it('matches a keyword at the very start', () => {
      expect(findTriggerKeyword('price?', ['price'])).toBe('price');
    });
  });

  describe('not matching', () => {
    it('returns null when nothing matches', () => {
      expect(findTriggerKeyword('잘 봤습니다', ['가격'])).toBeNull();
    });

    it('returns null for no keywords', () => {
      expect(findTriggerKeyword('가격 알려주세요', [])).toBeNull();
    });

    // "pricing" contains "price". A rule meant for one word should not answer
    // every comment that happens to contain it inside another.
    it('does not fire on a latin keyword buried inside a longer word', () => {
      expect(findTriggerKeyword('our pricing model', ['price'])).toBeNull();
    });

    it('skips an empty keyword rather than matching everything', () => {
      expect(findTriggerKeyword('아무 말', [''])).toBeNull();
    });
  });

  // Korean compounds have no internal spacing, so a boundary rule borrowed from
  // English would stop the feature working in the language it ships in.
  it('still matches a Korean keyword inside a compound', () => {
    expect(findTriggerKeyword('가격대비 좋아요', ['가격'])).toBe('가격');
  });
});
