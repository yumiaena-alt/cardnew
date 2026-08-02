/**
 * Cell coordinate and range model for the Board sheet.
 *
 * A selection is stored as anchor + focus (where the drag started and where the
 * cursor is now) rather than as normalized bounds, because shift-click and
 * keyboard extension both pivot on the anchor.
 */

export type CellCoord = {
  row: number;
  col: number;
};

export type CellRange = {
  anchor: CellCoord;
  focus: CellCoord;
};

export type RangeBounds = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

export type GridSize = {
  rowCount: number;
  colCount: number;
};

/**
 * Converts an anchor/focus pair into inclusive bounds.
 *
 * @param range - Selection with anchor and focus corners.
 * @returns Inclusive min/max row and column.
 */
export function getBounds(range: CellRange): RangeBounds {
  return {
    minRow: Math.min(range.anchor.row, range.focus.row),
    maxRow: Math.max(range.anchor.row, range.focus.row),
    minCol: Math.min(range.anchor.col, range.focus.col),
    maxCol: Math.max(range.anchor.col, range.focus.col),
  };
}

/**
 * Checks whether a cell falls inside a selection.
 *
 * @param range - Current selection.
 * @param cell - Cell to test.
 * @returns True when the cell is within the selection bounds.
 */
export function containsCell(range: CellRange, cell: CellCoord): boolean {
  const bounds = getBounds(range);

  return (
    cell.row >= bounds.minRow &&
    cell.row <= bounds.maxRow &&
    cell.col >= bounds.minCol &&
    cell.col <= bounds.maxCol
  );
}

/**
 * Counts the cells a selection covers. Used to size paste and fill operations.
 *
 * @param range - Current selection.
 * @returns Number of cells in the range.
 */
export function countCells(range: CellRange): number {
  const bounds = getBounds(range);

  return (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1);
}

/**
 * Clamps a coordinate to the grid so keyboard navigation stops at the edges
 * instead of producing out-of-bounds indices.
 *
 * @param cell - Requested coordinate.
 * @param size - Grid dimensions.
 * @returns Coordinate guaranteed to be inside the grid.
 */
export function clampCell(cell: CellCoord, size: GridSize): CellCoord {
  return {
    row: Math.min(Math.max(cell.row, 0), Math.max(size.rowCount - 1, 0)),
    col: Math.min(Math.max(cell.col, 0), Math.max(size.colCount - 1, 0)),
  };
}

/**
 * Moves the focus by a delta, keeping the anchor when extending a selection.
 *
 * @param options - Current range, movement delta, grid size, and whether the
 *   selection is being extended (shift held).
 * @returns The next selection.
 */
export function moveFocus(options: {
  range: CellRange;
  deltaRow: number;
  deltaCol: number;
  size: GridSize;
  extend: boolean;
}): CellRange {
  const next = clampCell(
    {
      row: options.range.focus.row + options.deltaRow,
      col: options.range.focus.col + options.deltaCol,
    },
    options.size,
  );

  return { anchor: options.extend ? options.range.anchor : next, focus: next };
}

/**
 * Computes the range a fill-handle drag would cover.
 *
 * The fill extends the source selection vertically only — dragging up or down
 * from the handle. Columns stay fixed, matching how spreadsheet users expect a
 * date or label column to continue.
 *
 * @param options - Source selection, the row the pointer reached, and grid size.
 * @returns Range covering source plus filled rows.
 */
export function getFillRange(options: {
  source: CellRange;
  targetRow: number;
  size: GridSize;
}): CellRange {
  const bounds = getBounds(options.source);
  const target = clampCell({ row: options.targetRow, col: bounds.minCol }, options.size);

  const startRow = target.row < bounds.minRow ? target.row : bounds.minRow;
  const endRow = target.row > bounds.maxRow ? target.row : bounds.maxRow;

  return {
    anchor: { row: startRow, col: bounds.minCol },
    focus: { row: endRow, col: bounds.maxCol },
  };
}

/**
 * Repeats source values across a target range, the way a spreadsheet tiles a
 * pasted block that is smaller than the destination.
 *
 * @param options - Source values and the destination bounds.
 * @returns Values for the destination, indexed `[row][col]` from its top-left.
 */
export function tileValues(options: {
  source: readonly (readonly string[])[];
  target: RangeBounds;
}): string[][] {
  const sourceRows = options.source.length;

  if (sourceRows === 0) {
    return [];
  }

  const rowCount = options.target.maxRow - options.target.minRow + 1;
  const colCount = options.target.maxCol - options.target.minCol + 1;

  return Array.from({ length: rowCount }, (_, rowOffset) => {
    const sourceRow = options.source[rowOffset % sourceRows] ?? [];
    const sourceCols = sourceRow.length;

    return Array.from({ length: colCount }, (__, colOffset) =>
      sourceCols === 0 ? '' : (sourceRow[colOffset % sourceCols] ?? ''),
    );
  });
}
