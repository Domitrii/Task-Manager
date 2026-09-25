import {
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Flame,
  ListChecks,
  type LucideIcon,
  Package,
  QrCode,
  Refrigerator,
  Settings,
  ShieldAlert,
  Snowflake,
  Soup,
  Thermometer,
  TrendingUp,
} from 'lucide-react'

/** Which live counter, if any, is shown against a nav item. */
export type NavBadge = 'today' | 'openIssues' | 'openTasks' | 'rejectedDeliveries'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Marks the item active only on an exact path match (used for section hubs). */
  end?: boolean
  badge?: NavBadge
}

/**
 * The three places people go every shift. On phones these are the bottom tabs,
 * either side of the Log button.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Today', to: '/', icon: CalendarCheck, end: true, badge: 'today' },
  { label: 'Tasks', to: '/tasks', icon: ListChecks, badge: 'openTasks' },
  { label: 'Reports', to: '/reports', icon: TrendingUp },
]

/** Where the records live — history, current status and the full lists. */
export const RECORD_NAV: NavItem[] = [
  { label: 'Temperatures', to: '/temperatures', icon: Thermometer },
  { label: 'Checklists', to: '/checklists', icon: ClipboardCheck },
  { label: 'Deliveries', to: '/deliveries', icon: Package, badge: 'rejectedDeliveries' },
  { label: 'Issues', to: '/food-safety', icon: ShieldAlert, badge: 'openIssues' },
  { label: 'Stock', to: '/stock', icon: ClipboardList },
]

export const SETTINGS_NAV: NavItem = { label: 'Settings', to: '/settings', icon: Settings }

/** Printable QR labels for equipment. Reached from Temperatures and Settings. */
export const QR_LABELS_NAV: NavItem = { label: 'QR labels', to: '/temperatures/labels', icon: QrCode }

/** Views inside Temperatures, shown as chips on the page rather than in the sidebar. */
export const TEMPERATURE_VIEWS: NavItem[] = [
  { label: 'All', to: '/temperatures', icon: Thermometer, end: true },
  { label: 'Fridges', to: '/temperatures/fridges', icon: Refrigerator },
  { label: 'Freezers', to: '/temperatures/freezers', icon: Snowflake },
  { label: 'Hot holding', to: '/temperatures/hot-holding', icon: Soup },
  { label: 'Cooking & cooling', to: '/temperatures/cooking', icon: Flame },
]

export const CHECKLIST_VIEWS: NavItem[] = [
  { label: 'All', to: '/checklists', icon: ClipboardCheck, end: true },
  { label: 'Opening & closing', to: '/checklists/opening-closing', icon: ClipboardCheck },
  { label: 'Cleaning', to: '/checklists/cleaning', icon: ClipboardCheck },
  { label: 'Food safety', to: '/checklists/food-safety', icon: ShieldAlert },
]

/** Every destination, for the command palette and the page title. */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...PRIMARY_NAV,
  ...RECORD_NAV,
  SETTINGS_NAV,
  QR_LABELS_NAV,
  ...TEMPERATURE_VIEWS.slice(1),
  ...CHECKLIST_VIEWS.slice(1).map((view) => ({ ...view, label: `${view.label} checklists` })),
]

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
