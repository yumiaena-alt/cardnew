'use client';

import { Menu, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CreditBadge } from '@/components/ui/CreditBadge';

type TopbarProps = {
  onOpenMobile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  creditBalance: number;
  children?: React.ReactNode;
};

export function Topbar(props: TopbarProps) {
  const t = useTranslations('DashboardTopbar');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <button
        type="button"
        onClick={props.onOpenMobile}
        className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
        aria-label={t('open_sidebar')}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <CreditBadge balance={props.creditBalance} />

        <button
          type="button"
          onClick={props.onToggleTheme}
          className="grid size-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={props.theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
        >
          {props.theme === 'dark' ? (
            <Sun className="size-4" aria-hidden="true" />
          ) : (
            <Moon className="size-4" aria-hidden="true" />
          )}
        </button>

        {props.children}
      </div>
    </header>
  );
}
