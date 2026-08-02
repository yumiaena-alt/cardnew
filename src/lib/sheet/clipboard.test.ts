import { describe, expect, it } from 'vitest';
import { parseClipboardTsv, serializeToTsv } from './clipboard';

describe(parseClipboardTsv, () => {
  it('splits columns on tabs and rows on newlines', () => {
    const result = parseClipboardTsv('a\tb\nc\td');

    expect(result).toStrictEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns an empty grid for blank input', () => {
    expect(parseClipboardTsv('')).toStrictEqual([]);
    expect(parseClipboardTsv('   \n  ')).toStrictEqual([]);
  });

  it('treats CRLF as a single row break', () => {
    expect(parseClipboardTsv('a\r\nb')).toStrictEqual([['a'], ['b']]);
  });

  it('keeps tabs and newlines inside quoted cells', () => {
    const result = parseClipboardTsv('"line one\nline two"\tnext');

    expect(result).toStrictEqual([['line one\nline two', 'next']]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseClipboardTsv('"say ""hi"""')).toStrictEqual([['say "hi"']]);
  });

  it('pads short rows to the widest row', () => {
    const result = parseClipboardTsv('a\tb\tc\nd');

    expect(result).toStrictEqual([
      ['a', 'b', 'c'],
      ['d', '', ''],
    ]);
  });

  it('ignores a trailing newline', () => {
    expect(parseClipboardTsv('a\tb\n')).toStrictEqual([['a', 'b']]);
  });
});

describe(serializeToTsv, () => {
  it('joins cells with tabs and rows with newlines', () => {
    expect(
      serializeToTsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a\tb\nc\td');
  });

  it('quotes cells containing a tab or newline', () => {
    expect(serializeToTsv([['has\ttab']])).toBe('"has\ttab"');
    expect(serializeToTsv([['has\nbreak']])).toBe('"has\nbreak"');
  });

  it('doubles quotes inside a quoted cell', () => {
    expect(serializeToTsv([['say "hi"']])).toBe('"say ""hi"""');
  });

  it('round-trips a grid through parse', () => {
    const grid = [
      ['여름 신메뉴', 'instagram\ttiktok'],
      ['quote "here"', 'multi\nline'],
    ];

    expect(parseClipboardTsv(serializeToTsv(grid))).toStrictEqual(grid);
  });
});
