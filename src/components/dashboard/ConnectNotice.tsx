import { Link2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/** Screens that stand still until an account is connected. */
type ConnectSurface = 'planning' | 'analytics' | 'automation' | 'comments';

type ConnectNoticeProps = {
  surface: ConnectSurface;
};

/**
 * Tells a screen's visitor why it is inert, and connects an account from here.
 *
 * Four screens depend on a connected account, and each one used to say so in
 * its empty state without offering a way out — the only screen that connects an
 * account was somewhere else entirely. Saying what is missing next to the
 * control that fixes it is the whole point.
 *
 * @param props - Which screen is asking.
 * @returns The notice, or nothing when this surface has no reason to show one.
 */
export async function ConnectNotice(props: ConnectNoticeProps) {
  const t = await getTranslations('ConnectNotice');

  return (
    <aside className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-secondary p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-foreground">
          <Link2 className="size-4" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">{t(`title_${props.surface}`)}</p>
          <p className="text-sm text-muted-foreground">{t(`description_${props.surface}`)}</p>
        </div>
      </div>

      <Button render={<Link href="/dashboard/settings/accounts">{t('action')}</Link>} />
    </aside>
  );
}
