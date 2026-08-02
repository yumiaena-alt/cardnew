'use client';

import { useState } from 'react';
import { parseClipboardTsv, serializeToTsv } from '@/lib/sheet/clipboard';
import type { History } from '@/lib/sheet/history';
import { canRedo, canUndo, createHistory, push, redo, undo } from '@/lib/sheet/history';
import type { CellCoord, CellRange, GridSize } from '@/lib/sheet/selection';
import { clampCell, getBounds, getFillRange, moveFocus, tileValues } from '@/lib/sheet/selection';

export type SheetRow = Record<string, string>;

export type SheetColumn = {
  key: string;
  labelKey: string;
  width: number;
};

const ORIGIN: CellRange = {
  anchor: { row: 0, col: 0 },
  focus: { row: 0, col: 0 },
};

type SheetState = {
  rows: SheetRow[];
};

export type BoardSheet = {
  rows: SheetRow[];
  selection: CellRange;
  editing: CellCoord | null;
  fillPreview: CellRange | null;
  canUndo: boolean;
  canRedo: boolean;
  size: GridSize;
  selectCell: (cell: CellCoord, extend: boolean) => void;
  navigate: (deltaRow: number, deltaCol: number, extend: boolean) => void;
  startEditing: (cell: CellCoord) => void;
  commitEdit: (cell: CellCoord, value: string) => void;
  cancelEdit: () => void;
  clearSelection: () => void;
  pasteAtSelection: (text: string) => void;
  copySelection: () => string;
  previewFill: (targetRow: number | null) => void;
  applyFill: () => void;
  undoEdit: () => void;
  redoEdit: () => void;
};

/**
 * Owns Board sheet state: which cells are selected, which cell is being edited,
 * and the undo history. All grid math lives in `@/lib/sheet` so this hook stays
 * a thin binding between those pure functions and React state.
 *
 * @param options - Column definitions and the initial rows.
 * @returns Sheet state and the operations the grid binds to.
 */
export function useBoardSheet(options: {
  columns: readonly SheetColumn[];
  initialRows: readonly SheetRow[];
}): BoardSheet {
  const [history, setHistory] = useState<History<SheetState>>(() =>
    createHistory<SheetState>({ rows: [...options.initialRows] }),
  );
  const [selection, setSelection] = useState<CellRange>(ORIGIN);
  const [editing, setEditing] = useState<CellCoord | null>(null);
  const [fillPreview, setFillPreview] = useState<CellRange | null>(null);

  const { rows } = history.present;
  const size: GridSize = { rowCount: rows.length, colCount: options.columns.length };

  const commitRows = (next: SheetRow[]) => {
    setHistory((current) => push(current, { rows: next }));
  };

  const writeRange = (range: CellRange, values: readonly (readonly string[])[]) => {
    const bounds = getBounds(range);
    const tiled = tileValues({ source: values, target: bounds });

    if (tiled.length === 0) {
      return;
    }

    commitRows(
      rows.map((row, rowIndex) => {
        if (rowIndex < bounds.minRow || rowIndex > bounds.maxRow) {
          return row;
        }

        const sourceRow = tiled[rowIndex - bounds.minRow] ?? [];
        const patch: SheetRow = { ...row };

        for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
          const column = options.columns[col];

          if (column) {
            patch[column.key] = sourceRow[col - bounds.minCol] ?? '';
          }
        }

        return patch;
      }),
    );
  };

  const readRange = (range: CellRange): string[][] => {
    const bounds = getBounds(range);
    const result: string[][] = [];

    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      const source = rows[row];
      const line: string[] = [];

      for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
        const column = options.columns[col];
        line.push(column && source ? (source[column.key] ?? '') : '');
      }

      result.push(line);
    }

    return result;
  };

  return {
    rows,
    selection,
    editing,
    fillPreview,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    size,

    selectCell: (cell, extend) => {
      const next = clampCell(cell, size);
      setSelection((current) => ({ anchor: extend ? current.anchor : next, focus: next }));
      setEditing(null);
    },

    navigate: (deltaRow, deltaCol, extend) => {
      setSelection((current) => moveFocus({ range: current, deltaRow, deltaCol, size, extend }));
      setEditing(null);
    },

    startEditing: (cell) => {
      setEditing(clampCell(cell, size));
    },

    commitEdit: (cell, value) => {
      writeRange({ anchor: cell, focus: cell }, [[value]]);
      setEditing(null);
    },

    cancelEdit: () => {
      setEditing(null);
    },

    clearSelection: () => {
      const bounds = getBounds(selection);
      const width = bounds.maxCol - bounds.minCol + 1;
      writeRange(selection, [Array.from({ length: width }, () => '')]);
    },

    pasteAtSelection: (text) => {
      const parsed = parseClipboardTsv(text);

      if (parsed.length === 0) {
        return;
      }

      const bounds = getBounds(selection);
      const firstRow = parsed[0] ?? [];
      // A multi-cell paste expands the target; a single value tiles into the selection.
      const spansMultipleCells = parsed.length > 1 || firstRow.length > 1;
      const target: CellRange = spansMultipleCells
        ? {
            anchor: { row: bounds.minRow, col: bounds.minCol },
            focus: clampCell(
              {
                row: bounds.minRow + parsed.length - 1,
                col: bounds.minCol + firstRow.length - 1,
              },
              size,
            ),
          }
        : selection;

      writeRange(target, parsed);
      setSelection(target);
    },

    copySelection: () => serializeToTsv(readRange(selection)),

    previewFill: (targetRow) => {
      setFillPreview(
        targetRow === null ? null : getFillRange({ source: selection, targetRow, size }),
      );
    },

    applyFill: () => {
      if (!fillPreview) {
        return;
      }

      writeRange(fillPreview, readRange(selection));
      setSelection(fillPreview);
      setFillPreview(null);
    },

    undoEdit: () => {
      setHistory(undo);
      setEditing(null);
    },

    redoEdit: () => {
      setHistory(redo);
      setEditing(null);
    },
  };
}
