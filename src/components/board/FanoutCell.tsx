'use client';

import { cn } from '@/lib/utils';

/** Channels a row can fan out to, with the aspect ratio each one renders at. */
export const FANOUT_CHANNELS = [
  { id: 'instagram', ratio: '4:5' },
  { id: 'threads', ratio: '1:1' },
  { id: 'tiktok', ratio: '9:16' },
  { id: 'blog', ratio: '16:9' },
] as const;

export type FanoutChannelId = (typeof FANOUT_CHANNELS)[number]['id'];

/**
 * Reads the comma-separated channel list stored in a sheet cell.
 *
 * @param value - Raw cell value.
 * @returns Selected channel ids, unknown entries dropped.
 */
export function parseFanout(value: string): FanoutChannelId[] {
  const known = new Set<string>(FANOUT_CHANNELS.map((channel) => channel.id));

  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is FanoutChannelId => known.has(part));
}

/**
 * Serializes selected channels back into a sheet cell value.
 *
 * @param channels - Selected channel ids.
 * @returns Comma-separated value in canonical channel order.
 */
export function serializeFanout(channels: readonly FanoutChannelId[]): string {
  const selected = new Set<string>(channels);

  return FANOUT_CHANNELS.filter((channel) => selected.has(channel.id))
    .map((channel) => channel.id)
    .join(',');
}

type FanoutCellProps = {
  value: string;
  labels: Record<FanoutChannelId, string>;
  isFocused: boolean;
  isInRange: boolean;
  onSelect: (extend: boolean) => void;
  onChange: (value: string) => void;
};

/**
 * Channel toggles for one Board row. The first selected channel is the origin
 * cut; the rest are derivatives, which is what makes them cheaper to generate.
 *
 * @param props - Cell value, channel labels, selection flags, and change handler.
 * @returns The grid cell element.
 */
export function FanoutCell(props: FanoutCellProps) {
  const selected = parseFanout(props.value);
  const selectedSet = new Set<string>(selected);

  const toggle = (id: FanoutChannelId) => {
    const next = selectedSet.has(id)
      ? selected.filter((channel) => channel !== id)
      : [...selected, id];

    props.onChange(serializeFanout(next));
  };

  return (
    <td
      tabIndex={props.isFocused ? 0 : -1}
      aria-selected={props.isInRange}
      onMouseDown={(event) => {
        props.onSelect(event.shiftKey);
      }}
      className={cn(
        'h-10 px-2 outline-none transition-colors',
        props.isInRange ? 'bg-signal-subtle' : 'hover:bg-accent',
        props.isFocused && 'outline-2 -outline-offset-2 outline-foreground',
      )}
    >
      <div className="flex items-center gap-1">
        {FANOUT_CHANNELS.map((channel) => {
          const active = selectedSet.has(channel.id);

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => {
                toggle(channel.id);
              }}
              aria-pressed={active}
              title={`${props.labels[channel.id]} · ${channel.ratio}`}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                active
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent',
              )}
            >
              {props.labels[channel.id]}
            </button>
          );
        })}
      </div>
    </td>
  );
}
