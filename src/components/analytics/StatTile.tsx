type StatTileProps = {
  label: string;
  value: string;
  hint?: string;
};

/**
 * One headline figure.
 *
 * Numbers use tabular figures so a row of tiles does not shift as values
 * change, which is what makes them readable side by side.
 *
 * @param props - Label, value, and an optional caption.
 * @returns The stat tile.
 */
export function StatTile(props: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{props.label}</span>
      <span className="tabular text-2xl font-semibold text-foreground">{props.value}</span>
      {props.hint ? <span className="text-xs text-muted-foreground">{props.hint}</span> : null}
    </div>
  );
}
