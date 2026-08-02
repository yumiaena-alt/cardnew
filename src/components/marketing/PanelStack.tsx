import { cn } from '@/lib/utils';

/**
 * The fan-out metaphor as a static composition: one source panel on the left,
 * three channel cuts stacked to the right.
 *
 * Built from layered surfaces and 1px lines rather than an illustration, so it
 * inherits the theme and stays crisp at every breakpoint. The lime marker is
 * the only signal-coloured element on the page — it sits exactly where the
 * generation happens.
 */

type CutProps = {
  ratioLabel: string;
  channelLabel: string;
  className?: string;
  /** Aspect ratio of the mock cut, expressed as a Tailwind aspect utility. */
  aspect: string;
};

function Cut(props: CutProps) {
  return (
    <figure
      className={cn(
        'flex w-full flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-3',
        'transition-transform duration-500 ease-out',
        props.className,
      )}
    >
      <div className={cn('w-full rounded-md bg-muted', props.aspect)} />
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{props.channelLabel}</span>
        <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
          {props.ratioLabel}
        </span>
      </figcaption>
    </figure>
  );
}

type PanelStackProps = {
  sourceLabel: string;
  generatedLabel: string;
  cuts: readonly { channelLabel: string; ratioLabel: string; aspect: string }[];
};

export function PanelStack(props: PanelStackProps) {
  return (
    <div className="grid w-full gap-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.6fr)] sm:items-center">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <span className="font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
          {props.sourceLabel}
        </span>
        <div className="aspect-4/5 w-full rounded-lg bg-primary/90" />
      </div>

      <div className="flex items-center justify-center sm:flex-col sm:gap-2">
        <span
          className="rounded-full bg-signal px-2.5 py-1 font-mono text-[0.65rem] font-semibold text-signal-foreground"
          aria-hidden="true"
        >
          {props.generatedLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {props.cuts.map((cut) => (
          <Cut
            key={cut.channelLabel}
            channelLabel={cut.channelLabel}
            ratioLabel={cut.ratioLabel}
            aspect={cut.aspect}
          />
        ))}
      </div>
    </div>
  );
}
