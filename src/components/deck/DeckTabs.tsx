'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * The three things a person does around making card news, side by side.
 *
 * Creating, teaching the tool a style, and looking at what was already made are
 * one activity split across three screens. Keeping them behind one strip means
 * checking what a run cost does not start with finding the right menu entry.
 */
const TABS = [
  { id: 'create', href: '/dashboard/deck/new' },
  { id: 'learn', href: '/dashboard/templates/learn' },
  { id: 'history', href: '/dashboard/deck/history' },
] as const;

/**
 * Tab strip for the card news screens.
 *
 * @returns The tab strip, with the entry matching the current route marked.
 */
export function DeckTabs() {
  const t = useTranslations('DeckTabs');
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="flex gap-1 rounded-xl border border-border bg-card p-1">
      {TABS.map((tab) => {
        // The locale prefixes the path, so the route is matched by its tail.
        const isActive = pathname.endsWith(tab.href);

        return (
          <Link
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            href={tab.href}
            key={tab.id}
          >
            {t(tab.id)}
          </Link>
        );
      })}
    </nav>
  );
}
