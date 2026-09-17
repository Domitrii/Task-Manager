import {
  ClipboardCheck,
  ClipboardList,
  Flame,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Package,
  Refrigerator,
  Settings,
  ShieldAlert,
  Snowflake,
  Soup,
  SprayCan,
  Thermometer,
  TrendingUp,
} from 'lucide-react'

/** Which live counter, if any, is shown against a nav item. */
export type NavBadge = 'overdueChecks' | 'openIssues' | 'openTasks' | 'rejectedDeliveries'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Marks the item active only on an exact path match (used for section hubs). */
  end?: boolean
  badge?: NavBadge
  children?: NavItem[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAVIGATION: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Temperature checks',
    items: [
      {
        label: 'All checks',
        to: '/temperatures',
        icon: Thermometer,
        end: true,
        badge: 'overdueChecks',
        children: [
          { label: 'Cooking', to: '/temperatures/cooking', icon: Flame },
          { label: 'Fridges', to: '/temperatures/fridges', icon: Refrigerator },
          { label: 'Freezers', to: '/temperatures/freezers', icon: Snowflake },
          { label: 'Hot holding', to: '/temperatures/hot-holding', icon: Soup },
        ],
      },
    ],
  },
  {
    title: 'Daily operations',
    items: [
      { label: 'Deliveries', to: '/deliveries', icon: Package, badge: 'rejectedDeliveries' },
      { label: 'Food safety', to: '/food-safety', icon: ShieldAlert, badge: 'openIssues' },
      { label: 'Cleaning', to: '/cleaning', icon: SprayCan },
      { label: 'Opening & closing', to: '/opening-closing', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Stock', to: '/stock', icon: ClipboardList },
      { label: 'Tasks', to: '/tasks', icon: ListChecks, badge: 'openTasks' },
      { label: 'Reports', to: '/reports', icon: TrendingUp },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

/** Flattened list of every route in the sidebar — used by the command palette. */
export const ALL_NAV_ITEMS: NavItem[] = NAVIGATION.flatMap((section) =>
  section.items.flatMap((item) => [item, ...(item.children ?? [])]),
)

export const CATEGORY_LABELS = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  display_fridge: 'Display fridge',
  hot_holding: 'Hot holding',
  cooking: 'Cooking',
  cooling: 'Cooling',
} as const

export const CATEGORY_ICONS: Record<keyof typeof CATEGORY_LABELS, LucideIcon> = {
  fridge: Refrigerator,
  freezer: Snowflake,
  display_fridge: Refrigerator,
  hot_holding: Soup,
  cooking: Flame,
  cooling: Snowflake,
}
