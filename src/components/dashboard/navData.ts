import type { LucideIcon } from 'lucide-react';
import { Calendar, FileText, Images, LayoutGrid, LineChart, Palette, Sparkles } from 'lucide-react';

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
  | 'template_gallery'
  | 'template_learn'
  | 'calendar'
  | 'analytics';

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
    id: 'board',
    labelKey: 'board',
    icon: LayoutGrid,
    href: '/dashboard/board',
    phase: 2,
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
    id: 'blog',
    labelKey: 'blog',
    icon: FileText,
    href: '/dashboard/blog',
    phase: 1,
  },
  {
    id: 'template',
    labelKey: 'template',
    icon: Palette,
    phase: 1,
    children: [
      { id: 'template-gallery', labelKey: 'template_gallery', href: '/dashboard/templates' },
      { id: 'template-learn', labelKey: 'template_learn', href: '/dashboard/templates/learn' },
    ],
  },
  {
    id: 'calendar',
    labelKey: 'calendar',
    icon: Calendar,
    href: '/dashboard/calendar',
    phase: 3,
  },
  {
    id: 'analytics',
    labelKey: 'analytics',
    icon: LineChart,
    href: '/dashboard/analytics',
    phase: 3,
  },
];

/** Bump as roadmap phases ship. Gates which nav entries are visible. */
const CURRENT_PHASE = 2;

export const visibleNavGroups = navGroups.filter((group) => group.phase <= CURRENT_PHASE);
