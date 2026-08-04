import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  FileText,
  Images,
  LayoutGrid,
  LineChart,
  MessageCircle,
  Palette,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

/** Keys available in the `DashboardNav` i18n namespace. Keeps `t()` type-safe. */
export type NavLabelKey =
  | 'planning'
  | 'planning_ideas'
  | 'planning_reference'
  | 'board'
  | 'deck'
  | 'deck_link'
  | 'deck_new'
  | 'deck_list'
  | 'blog'
  | 'template'
  | 'automation'
  | 'comments'
  | 'calendar'
  | 'analytics'
  | 'settings'
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
      { id: 'deck-list', labelKey: 'deck_list', href: '/dashboard/deck' },
    ],
  },
  {
    id: 'board',
    labelKey: 'board',
    icon: LayoutGrid,
    href: '/dashboard/board',
    phase: 2,
  },
  {
    id: 'blog',
    labelKey: 'blog',
    icon: FileText,
    href: '/dashboard/blog',
    phase: 1,
  },
  // Design learning lives in the card news tabs, next to creating and history,
  // because teaching a style is something you do while making — not a place you
  // navigate to. That leaves one template destination, so it stops being a group.
  {
    id: 'template',
    labelKey: 'template',
    icon: Palette,
    href: '/dashboard/templates',
    phase: 1,
  },
  {
    id: 'calendar',
    labelKey: 'calendar',
    icon: Calendar,
    href: '/dashboard/calendar',
    phase: 2,
  },
  {
    id: 'analytics',
    labelKey: 'analytics',
    icon: LineChart,
    href: '/dashboard/analytics',
    phase: 2,
  },
  {
    id: 'automation',
    labelKey: 'automation',
    icon: Zap,
    href: '/dashboard/automation',
    phase: 2,
  },
  {
    id: 'comments',
    labelKey: 'comments',
    icon: MessageCircle,
    href: '/dashboard/comments',
    phase: 2,
  },
  {
    id: 'settings',
    labelKey: 'settings',
    icon: Settings,
    phase: 2,
    children: [
      {
        id: 'settings-accounts',
        labelKey: 'settings_accounts',
        href: '/dashboard/settings/accounts',
      },
    ],
  },
];

/** Bump as roadmap phases ship. Gates which nav entries are visible. */
const CURRENT_PHASE = 2;

export const visibleNavGroups = navGroups.filter((group) => group.phase <= CURRENT_PHASE);
