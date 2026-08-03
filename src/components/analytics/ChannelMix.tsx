import { useTranslations } from 'next-intl';
import type { ChannelShare } from '@/features/analytics/share';

type ChannelMixProps = {
  shares: ChannelShare[];
};

/**
 * How production is spread across channels.
 *
 * @param props - Channel shares, largest first.
 * @returns The channel mix panel.
 */
export function ChannelMix(props: ChannelMixProps) {
  const t = useTranslations('AnalyticsPage');

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">{t('channel_heading')}</h2>

      {props.shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('channel_empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.shares.map((share) => (
            <li key={share.channel} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{share.channel}</span>
                <span className="tabular text-muted-foreground">{share.count}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${share.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
