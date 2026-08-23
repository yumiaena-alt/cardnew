'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * The three things making an instatoon is made of, side by side.
 *
 * Drawing, casting, and studying a format are one activity split across three
 * screens, and the order matters: you cannot make a toon before there is a
 * character to draw. Keeping them behind one strip means the missing step is
 * one click away rather than somewhere in the menu.
 */
const TABS = [
  { id: 'create', href: '/dashboard/toon' },
  { id: 'characters', href: '/dashboard/toon/characters' },
  { id: 'formulas', href: '/dashboard/toon/formulas' },
] as const;

/**
 * Tab strip for the instatoon screens.
 *
 * @returns The tab strip, with the entry matching the current route marked.
 */
export function ToonTabs() {
  const t = useTranslations('ToonTabs');
  const pathname = usePathname();

  // Named one by one rather than looked up from the tab id. A dynamic `t(key)`
  // reads to the i18n checker as a key nobody uses.
  const labels: Record<(typeof TABS)[number]['id'], string> = {
    create: t('create'),
    characters: t('characters'),
    formulas: t('formulas'),
  };

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
            {labels[tab.id]}
          </Link>
        );
      })}
    </nav>
  );
}
