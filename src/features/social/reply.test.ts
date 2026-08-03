import { describe, expect, it } from 'vitest';
import { composeReply } from './reply';

describe('private reply', () => {
  describe(composeReply, () => {
    it('sends the message alone when the rule carries no link', () => {
      expect(composeReply('가격표 보내드릴게요', null)).toBe('가격표 보내드릴게요');
    });

    // Separated by a blank line rather than appended inline: the networks turn
    // a bare URL on its own line into a preview, and a trailing one glued to a
    // sentence often does not link at all.
    it('puts the link on its own line', () => {
      expect(composeReply('여기 있어요', 'https://example.com/price')).toBe(
        '여기 있어요\n\nhttps://example.com/price',
      );
    });
  });
});
