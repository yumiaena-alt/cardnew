import type { LucideIcon } from 'lucide-react';
import { Calendar, Images, Share2, Sparkles } from 'lucide-react';

/** Keys available in the `DashboardNav` i18n namespace. Keeps `t()` type-safe. */
export type NavLabelKey =
  | 'planning'
  | 'planning_ideas'
  | 'planning_reference'
  | 'deck'
  | 'deck_link'
  | 'deck_new'
  | 'deck_list'
  | 'deck_video'
  | 'blog'
  | 'automation'
  | 'comments'
  | 'calendar'
  | 'analytics'
  | 'social'
  | 'settings_accounts';

type NavItem = {
  id: string;
  /** i18n key inside the `DashboardNav` namespace. Never a literal string. */
  labelKey: NavLabelKey;
  href: string;
};

export type NavGroup = {
  id: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  /** Set for single-destination entries. Mutually exclusive with `children`. */
  href?: string;
  children?: NavItem[];
  /** Roadmap phase that unlocks this entry. Entries above the current phase stay hidden. */
  phase: 1 | 2 | 3 | 4;
};

/**
 * Dashboard navigation. Entries are filtered by `CURRENT_PHASE` so unfinished
 * sections never render as dead menu items.
 */
const navGroups: NavGroup[] = [
  {
    id: 'planning',
    labelKey: 'planning',
    icon: Sparkles,
    phase: 1,
    children: [
      { id: 'planning-ideas', labelKey: 'planning_ideas', href: '/dashboard/planning' },
      {
        id: 'planning-reference',
        labelKey: 'planning_reference',
        href: '/dashboard/planning/reference',
      },
    ],
  },
  {
    id: 'deck',
    labelKey: 'deck',
    icon: Images,
    phase: 1,
    children: [
      { id: 'deck-link', labelKey: 'deck_link', href: '/dashboard/deck/link' },
      { id: 'deck-new', labelKey: 'deck_new', href: '/dashboard/deck/new' },
      { id: 'deck-video', labelKey: 'deck_video', href: '/dashboard/video' },
      { id: 'deck-blog', labelKey: 'blog', href: '/dashboard/blog' },
      { id: 'deck-list', labelKey: 'deck_list', href: '/dashboard/deck' },
    ],
  },
  {
    id: 'calendar',
    labelKey: 'calendar',
    icon: Calendar,
    href: '/dashboard/calendar',
    phase: 2,
  },
  // Everything that only matters once an account is connected, kept together:
  // results, DM rules, the comment inbox, and the connection they all depend on.
  // Separately they were four entries in three parts of the menu, and the one
  // that turns the other three on was the easiest to miss.
  {
    id: 'social',
    labelKey: 'social',
    icon: Share2,
    phase: 2,
    children: [
      { id: 'social-analytics', labelKey: 'analytics', href: '/dashboard/analytics' },
      { id: 'social-automation', labelKey: 'automation', href: '/dashboard/automation' },
      { id: 'social-comments', labelKey: 'comments', href: '/dashboard/comments' },
      {
        id: 'social-accounts',
        labelKey: 'settings_accounts',
        href: '/dashboard/settings/accounts',
      },
    ],
  },
];

/** Bump as roadmap phases ship. Gates which nav entries are visible. */
const CURRENT_PHASE = 2;

export const visibleNavGroups = navGroups.filter((group) => group.phase <= CURRENT_PHASE);
