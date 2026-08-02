'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type BoardCellProps = {
  value: string;
  rowIndex: number;
  colIndex: number;
  isFocused: boolean;
  isInRange: boolean;
  isInFillPreview: boolean;
  isEditing: boolean;
  error?: string;
  align?: 'start' | 'end';
  /** Fill handle, rendered in the bottom-right corner of the last selected cell. */
  handle?: React.ReactNode;
  onSelect: (extend: boolean) => void;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

/**
 * A single editable cell in the Board sheet.
 *
 * Kept separate from a plain input because a sheet cell has five visual states
 * (idle, hover, focused, editing, in-range) that a form field does not.
 *
 * @param props - Cell value, its position, selection flags, and edit callbacks.
 * @returns The grid cell element.
 */
export function BoardCell(props: BoardCellProps) {
  const [draft, setDraft] = useState(props.value);

  const beginEdit = () => {
    setDraft(props.value);
    props.onStartEdit();
  };

  if (props.isEditing) {
    return (
      <td className="relative border-l border-border p-0">
        <input
          autoFocus
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={() => {
            props.onCommit(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              props.onCommit(draft);
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              props.onCancel();
            }

            event.stopPropagation();
          }}
          className="h-10 w-full bg-card px-3 text-sm text-foreground shadow-sm outline-2 outline-foreground"
        />
      </td>
    );
  }

  return (
    <td
      tabIndex={props.isFocused ? 0 : -1}
      aria-selected={props.isInRange}
      aria-invalid={props.error !== undefined}
      onMouseDown={(event) => {
        props.onSelect(event.shiftKey);
      }}
      onDoubleClick={beginEdit}
      className={cn(
        'relative h-10 cursor-cell border-l border-border px-3 text-sm outline-none transition-colors',
        props.align === 'end' && 'text-right tabular',
        props.isInRange || props.isInFillPreview ? 'bg-signal-subtle' : 'hover:bg-accent',
        props.isFocused && 'outline-2 -outline-offset-2 outline-foreground',
      )}
      title={props.error}
    >
      <span className="block truncate text-foreground">{props.value}</span>

      {props.error !== undefined && (
        <span
          className="absolute top-0 right-0 size-0 border-t-[6px] border-l-[6px] border-t-destructive border-l-transparent"
          aria-hidden="true"
        />
      )}

      {props.handle}
    </td>
  );
}
