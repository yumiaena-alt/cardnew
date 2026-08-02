'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

type Theme = 'light' | 'dark';

type DashboardShellProps = {
  children: React.ReactNode;
  /** Rendered at the right end of the topbar — user button, locale switcher. */
  topbarActions?: React.ReactNode;
  creditBalance: number;
  planKey: string;
};

/**
 * Dashboard chrome: collapsible sidebar, topbar, scrollable main area.
 * Server data arrives as props so the shell stays the only client boundary.
 *
 * @param props - Page content, topbar actions, and server-resolved plan data.
 * @returns The dashboard shell.
 */
export function DashboardShell(props: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => {
          setMobileOpen(false);
        }}
        creditBalance={props.creditBalance}
        planKey={props.planKey}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobile={() => {
            setMobileOpen(true);
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
          creditBalance={props.creditBalance}
        >
          {props.topbarActions}
        </Topbar>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{props.children}</main>
      </div>
    </div>
  );
}
