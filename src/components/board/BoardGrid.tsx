'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { containsCell, getBounds } from '@/lib/sheet/selection';
import { BoardCell } from './BoardCell';
import type { FanoutChannelId } from './FanoutCell';
import { FanoutCell } from './FanoutCell';
import type { BoardSheet, SheetColumn } from './useBoardSheet';

/** Row height in pixels. Used to convert a fill-handle drag into a row index. */
const ROW_HEIGHT = 40;

/** Column key holding the fan-out channel list. */
export const FANOUT_COLUMN_KEY = 'fanout';

type BoardGridProps = {
  sheet: BoardSheet;
  columns: readonly SheetColumn[];
  columnLabels: Record<string, string>;
  channelLabels: Record<FanoutChannelId, string>;
};

function isEditableKey(key: string) {
  return key.length === 1 && key !== ' ';
}

/**
 * Spreadsheet view of a Board. Renders as a real `role="grid"` table so screen
 * readers announce row and column position, and binds keyboard, clipboard, and
 * fill-handle interactions to the pure helpers in `@/lib/sheet`.
 *
 * @param props - Sheet state, column definitions, and translated labels.
 * @returns The grid element.
 */
export function BoardGrid(props: BoardGridProps) {
  const t = useTranslations('BoardPage');
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const { sheet } = props;
  const bounds = getBounds(sheet.selection);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        sheet.redoEdit();
      } else {
        sheet.undoEdit();
      }
      return;
    }

    const navigation: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = navigation[event.key];

    if (delta) {
      event.preventDefault();
      sheet.navigate(delta[0], delta[1], event.shiftKey);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      sheet.navigate(0, event.shiftKey ? -1 : 1, false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      sheet.startEditing(sheet.selection.focus);
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      sheet.clearSelection();
      return;
    }

    if (!meta && isEditableKey(event.key)) {
      sheet.startEditing(sheet.selection.focus);
    }
  };

  const startFillDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const originY = event.clientY;
    const originRow = bounds.maxRow;
    // Carried in the drag's own scope, not in React state: the listeners below
    // are registered once and cannot see a re-render.
    let targetRow = originRow;

    const onMove = (moveEvent: PointerEvent) => {
      const offsetRows = Math.round((moveEvent.clientY - originY) / ROW_HEIGHT);
      targetRow = originRow + offsetRows;
      sheet.previewFill(targetRow);
    };

    const onUp = () => {
      // A drag that never left the handle is a click. Filling anyway would put
      // an undo step on the stack for a change nobody made.
      if (targetRow === originRow) {
        sheet.previewFill(null);
      } else {
        sheet.applyFill(targetRow);
      }

      globalThis.removeEventListener('pointermove', onMove);
      globalThis.removeEventListener('pointerup', onUp);
    };

    globalThis.addEventListener('pointermove', onMove);
    globalThis.addEventListener('pointerup', onUp);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table
        className="w-full border-collapse"
        role="grid"
        aria-rowcount={sheet.rows.length}
        aria-colcount={props.columns.length}
        aria-label={t('grid_label')}
        onKeyDown={handleKeyDown}
        onCopy={(event) => {
          event.preventDefault();
          event.clipboardData.setData('text/plain', sheet.copySelection());
        }}
        onPaste={(event) => {
          event.preventDefault();
          sheet.pasteAtSelection(event.clipboardData.getData('text/plain'));
        }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="w-10 border-b border-border bg-muted px-2 py-2 text-right text-xs font-medium text-muted-foreground"
            >
              #
            </th>
            {props.columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width }}
                className="border-b border-l border-border bg-muted px-3 py-2 text-left text-xs font-semibold text-foreground"
              >
                {props.columnLabels[column.key]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody ref={bodyRef}>
          {sheet.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              aria-rowindex={rowIndex + 1}
              className="border-b border-border last:border-b-0"
            >
              <th
                scope="row"
                className="tabular w-10 border-r border-border bg-muted/50 px-2 text-right text-xs font-normal text-muted-foreground"
              >
                {rowIndex + 1}
              </th>

              {props.columns.map((column, colIndex) => {
                const cell = { row: rowIndex, col: colIndex };
                const isFocused =
                  sheet.selection.focus.row === rowIndex && sheet.selection.focus.col === colIndex;
                const isInRange = containsCell(sheet.selection, cell);
                const isLastSelected = rowIndex === bounds.maxRow && colIndex === bounds.maxCol;

                if (column.key === FANOUT_COLUMN_KEY) {
                  return (
                    <FanoutCell
                      key={column.key}
                      value={row[column.key] ?? ''}
                      labels={props.channelLabels}
                      isFocused={isFocused}
                      isInRange={isInRange}
                      onSelect={(extend) => {
                        sheet.selectCell(cell, extend);
                      }}
                      onChange={(value) => {
                        sheet.commitEdit(cell, value);
                      }}
                    />
                  );
                }

                return (
                  <BoardCell
                    key={column.key}
                    value={row[column.key] ?? ''}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    isFocused={isFocused}
                    isInRange={isInRange}
                    isInFillPreview={
                      sheet.fillPreview !== null && containsCell(sheet.fillPreview, cell)
                    }
                    isEditing={sheet.editing?.row === rowIndex && sheet.editing?.col === colIndex}
                    onSelect={(extend) => {
                      sheet.selectCell(cell, extend);
                    }}
                    onStartEdit={() => {
                      sheet.startEditing(cell);
                    }}
                    onCommit={(value) => {
                      sheet.commitEdit(cell, value);
                    }}
                    onCancel={sheet.cancelEdit}
                    handle={
                      isLastSelected ? (
                        <button
                          type="button"
                          onPointerDown={startFillDrag}
                          aria-label={t('fill_handle')}
                          className="absolute -right-1 -bottom-1 z-10 size-2 cursor-ns-resize rounded-full bg-signal-strong"
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
