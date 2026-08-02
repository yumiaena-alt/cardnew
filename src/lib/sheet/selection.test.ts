import { describe, expect, it } from 'vitest';
import {
  clampCell,
  containsCell,
  countCells,
  getBounds,
  getFillRange,
  moveFocus,
  tileValues,
} from './selection';

const SIZE = { rowCount: 5, colCount: 4 };

describe(getBounds, () => {
  it('normalizes a range dragged upward and leftward', () => {
    const bounds = getBounds({ anchor: { row: 3, col: 3 }, focus: { row: 1, col: 1 } });

    expect(bounds).toStrictEqual({ minRow: 1, maxRow: 3, minCol: 1, maxCol: 3 });
  });
});

describe(containsCell, () => {
  it('includes cells on the range edge', () => {
    const range = { anchor: { row: 1, col: 1 }, focus: { row: 3, col: 2 } };

    expect(containsCell(range, { row: 1, col: 1 })).toBeTruthy();
    expect(containsCell(range, { row: 3, col: 2 })).toBeTruthy();
  });

  it('excludes cells outside the range', () => {
    const range = { anchor: { row: 1, col: 1 }, focus: { row: 3, col: 2 } };

    expect(containsCell(range, { row: 0, col: 1 })).toBeFalsy();
    expect(containsCell(range, { row: 2, col: 3 })).toBeFalsy();
  });
});

describe(countCells, () => {
  it('counts a single cell as one', () => {
    expect(countCells({ anchor: { row: 2, col: 2 }, focus: { row: 2, col: 2 } })).toBe(1);
  });

  it('counts a rectangular range', () => {
    expect(countCells({ anchor: { row: 0, col: 0 }, focus: { row: 2, col: 3 } })).toBe(12);
  });
});

describe(clampCell, () => {
  it('holds the coordinate inside the grid', () => {
    expect(clampCell({ row: -3, col: 99 }, SIZE)).toStrictEqual({ row: 0, col: 3 });
  });

  it('returns the origin for an empty grid', () => {
    expect(clampCell({ row: 4, col: 4 }, { rowCount: 0, colCount: 0 })).toStrictEqual({
      row: 0,
      col: 0,
    });
  });
});

describe(moveFocus, () => {
  it('collapses the range when not extending', () => {
    const next = moveFocus({
      range: { anchor: { row: 0, col: 0 }, focus: { row: 2, col: 2 } },
      deltaRow: 1,
      deltaCol: 0,
      size: SIZE,
      extend: false,
    });

    expect(next).toStrictEqual({ anchor: { row: 3, col: 2 }, focus: { row: 3, col: 2 } });
  });

  it('keeps the anchor when extending', () => {
    const next = moveFocus({
      range: { anchor: { row: 0, col: 0 }, focus: { row: 1, col: 0 } },
      deltaRow: 1,
      deltaCol: 0,
      size: SIZE,
      extend: true,
    });

    expect(next.anchor).toStrictEqual({ row: 0, col: 0 });
    expect(next.focus).toStrictEqual({ row: 2, col: 0 });
  });

  it('stops at the grid edge', () => {
    const next = moveFocus({
      range: { anchor: { row: 4, col: 0 }, focus: { row: 4, col: 0 } },
      deltaRow: 1,
      deltaCol: 0,
      size: SIZE,
      extend: false,
    });

    expect(next.focus).toStrictEqual({ row: 4, col: 0 });
  });
});

describe(getFillRange, () => {
  it('extends downward from the source', () => {
    const range = getFillRange({
      source: { anchor: { row: 1, col: 0 }, focus: { row: 1, col: 1 } },
      targetRow: 4,
      size: SIZE,
    });

    expect(getBounds(range)).toStrictEqual({ minRow: 1, maxRow: 4, minCol: 0, maxCol: 1 });
  });

  it('extends upward from the source', () => {
    const range = getFillRange({
      source: { anchor: { row: 3, col: 0 }, focus: { row: 3, col: 0 } },
      targetRow: 0,
      size: SIZE,
    });

    expect(getBounds(range)).toStrictEqual({ minRow: 0, maxRow: 3, minCol: 0, maxCol: 0 });
  });

  it('leaves columns untouched', () => {
    const range = getFillRange({
      source: { anchor: { row: 0, col: 2 }, focus: { row: 0, col: 2 } },
      targetRow: 3,
      size: SIZE,
    });

    expect(getBounds(range).minCol).toBe(2);
    expect(getBounds(range).maxCol).toBe(2);
  });

  it('clamps a target beyond the last row', () => {
    const range = getFillRange({
      source: { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } },
      targetRow: 99,
      size: SIZE,
    });

    expect(getBounds(range).maxRow).toBe(4);
  });
});

describe(tileValues, () => {
  it('repeats a single row down the target', () => {
    const result = tileValues({
      source: [['a', 'b']],
      target: { minRow: 0, maxRow: 2, minCol: 0, maxCol: 1 },
    });

    expect(result).toStrictEqual([
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'],
    ]);
  });

  it('repeats a single column across the target', () => {
    const result = tileValues({
      source: [['x']],
      target: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 2 },
    });

    expect(result).toStrictEqual([
      ['x', 'x', 'x'],
      ['x', 'x', 'x'],
    ]);
  });

  it('cycles a source shorter than the target', () => {
    const result = tileValues({
      source: [['1'], ['2']],
      target: { minRow: 0, maxRow: 4, minCol: 0, maxCol: 0 },
    });

    expect(result.flat()).toStrictEqual(['1', '2', '1', '2', '1']);
  });

  it('returns nothing for an empty source', () => {
    expect(
      tileValues({ source: [], target: { minRow: 0, maxRow: 2, minCol: 0, maxCol: 1 } }),
    ).toStrictEqual([]);
  });
});
