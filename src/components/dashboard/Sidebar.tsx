'use client';

import { ChevronDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import type { NavGroup, NavLabelKey } from './navData';
import { visibleNavGroups } from './navData';

const LOGO_MARK_BARS = [0, 1, 2];

type NavLabels = Record<NavLabelKey, string>;

/**
 * Resolves every nav label up front. Keys are referenced literally so the i18n
 * checker can see them — a dynamic `t(key)` would read as an unused key.
 *
 * @returns Every `DashboardNav` label keyed by its nav key.
 */
function useNavLabels(): NavLabels {
  const t = useTranslations('DashboardNav');

  return {
    planning: t('planning'),
    planning_ideas: t('planning_ideas'),
    planning_reference: t('planning_reference'),
    board: t('board'),
    deck: t('deck'),
    deck_link: t('deck_link'),
    deck_new: t('deck_new'),
    deck_list: t('deck_list'),
    blog: t('blog'),
    template: t('template'),
    automation: t('automation'),
    comments: t('comments'),
    calendar: t('calendar'),
    analytics: t('analytics'),
    settings: t('settings'),
    settings_accounts: t('settings_accounts'),
  };
}

function Logo() {
  const t = useTranslations('DashboardNav');

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex size-7 items-center justify-center gap-[3px] rounded-md bg-primary px-1.5"
        aria-hidden="true"
      >
        {LOGO_MARK_BARS.map((bar) => (
          <span
            key={bar}
            className="h-3.5 w-[3px] rounded-full bg-primary-foreground"
            style={{ opacity: 1 - bar * 0.28 }}
          />
        ))}
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">{t('brand_name')}</span>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavGroupEntryProps = {
  group: NavGroup;
  labels: NavLabels;
  pathname: string;
  openGroups: Record<string, boolean>;
  onToggle: (id: string) => void;
};

function NavGroupEntry(props: NavGroupEntryProps) {
  const Icon = props.group.icon;

  if (props.group.href) {
    const active = isActive(props.pathname, props.group.href);

    return (
      <li>
        <Link
          href={props.group.href}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-foreground hover:bg-accent',
          )}
          aria-current={active ? 'page' : undefined}
        >
          <Icon className="size-[18px] text-muted-foreground" aria-hidden="true" />
          {props.labels[props.group.labelKey]}
        </Link>
      </li>
    );
  }

  const isOpen = props.openGroups[props.group.id] ?? true;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          props.onToggle(props.group.id);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-expanded={isOpen}
      >
        <Icon className="size-[18px] text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-left">{props.labels[props.group.labelKey]}</span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            isOpen ? 'rotate-0' : '-rotate-90',
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && props.group.children && (
        <ul className="mt-1 flex flex-col gap-1 pl-4">
          {props.group.children.map((child) => {
            const active = isActive(props.pathname, child.href);

            return (
              <li key={child.id}>
                <Link
                  href={child.href}
                  className={cn(
                    'flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {props.labels[child.labelKey]}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  creditBalance: number;
  planKey: string;
};

export function Sidebar(props: SidebarProps) {
  const t = useTranslations('DashboardNav');
  const labels = useNavLabels();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  return (
    <>
      {props.mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={props.onCloseMobile}
          aria-label={t('close_sidebar')}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0',
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={t('primary_navigation')}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Logo />
          <button
            type="button"
            onClick={props.onCloseMobile}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
            aria-label={t('close_sidebar')}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-4 border-t border-sidebar-border" />

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-1">
            {visibleNavGroups.map((group) => (
              <NavGroupEntry
                key={group.id}
                group={group}
                labels={labels}
                pathname={pathname}
                openGroups={openGroups}
                onToggle={toggleGroup}
              />
            ))}
          </ul>
        </nav>

        <div className="mx-4 border-t border-sidebar-border" />

        <div className="px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{props.planKey}</span>
            <span className="tabular text-muted-foreground">
              {t('credits_left', { count: props.creditBalance })}
            </span>
          </div>
          <Link
            href="/dashboard/settings/plan"
            className="mt-2 flex w-full items-center justify-center rounded-lg border border-sidebar-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t('upgrade')}
          </Link>
        </div>
      </aside>
    </>
  );
}
