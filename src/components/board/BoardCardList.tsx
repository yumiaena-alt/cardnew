'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { FANOUT_COLUMN_KEY } from './BoardGrid';
import type { FanoutChannelId } from './FanoutCell';
import { FANOUT_CHANNELS, parseFanout, serializeFanout } from './FanoutCell';
import type { BoardSheet, SheetColumn } from './useBoardSheet';

type BoardCardListProps = {
  sheet: BoardSheet;
  columns: readonly SheetColumn[];
  columnLabels: Record<string, string>;
  channelLabels: Record<FanoutChannelId, string>;
};

/**
 * Board fallback below `lg`. A horizontally scrolling sheet is unusable on a
 * phone, so each row becomes a stacked card with the same fields.
 *
 * @param props - Sheet state, column definitions, and translated labels.
 * @returns The card list.
 */
export function BoardCardList(props: BoardCardListProps) {
  const t = useTranslations('BoardPage');

  return (
    <ul className="flex flex-col gap-3">
      {props.sheet.rows.map((row, rowIndex) => (
        <li key={rowIndex} className="rounded-lg border border-border bg-card p-4">
          <p className="tabular text-xs text-muted-foreground">
            {t('row_number', { index: rowIndex + 1 })}
          </p>

          {props.columns.map((column, colIndex) => {
            const cell = { row: rowIndex, col: colIndex };
            const value = row[column.key] ?? '';

            if (column.key === FANOUT_COLUMN_KEY) {
              const selected = new Set<string>(parseFanout(value));

              return (
                <div key={column.key} className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {props.columnLabels[column.key]}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {FANOUT_CHANNELS.map((channel) => {
                      const active = selected.has(channel.id);

                      return (
                        <button
                          key={channel.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            const next = active
                              ? parseFanout(value).filter((item) => item !== channel.id)
                              : [...parseFanout(value), channel.id];

                            props.sheet.commitEdit(cell, serializeFanout(next));
                          }}
                          className={cn(
                            'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                            active
                              ? 'border-transparent bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground',
                          )}
                        >
                          {props.channelLabels[channel.id]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <label key={column.key} className="mt-3 block">
                <span className="text-xs font-medium text-muted-foreground">
                  {props.columnLabels[column.key]}
                </span>
                <input
                  value={value}
                  onChange={(event) => {
                    props.sheet.commitEdit(cell, event.target.value);
                  }}
                  className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </label>
            );
          })}
        </li>
      ))}
    </ul>
  );
}
