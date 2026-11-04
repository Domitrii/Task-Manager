import {
  Calendar,
  CalendarRange,
  ChartNoAxesColumn,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Flame,
  House,
  LayoutTemplate,
  type LucideIcon,
  Package,
  QrCode,
  Refrigerator,
  Settings,
  ShieldAlert,
  Snowflake,
  Soup,
  Thermometer,
  Truck,
  Users,
} from 'lucide-react'

/** Which live counter, if any, is shown against a nav item. */
export type NavBadge = 'today' | 'openIssues' | 'openTasks' | 'ordersToCheckIn'

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
  { label: 'Home', to: '/', icon: House, end: true, badge: 'today' },
  { label: 'Checklist', to: '/tasks', icon: FileText, badge: 'openTasks' },
  { label: 'Reports', to: '/reports', icon: ChartNoAxesColumn },
]

/** Someone's shifts. On phones it's the calendar in the top band. */
export const CALENDAR_NAV: NavItem = { label: 'Calendar', to: '/calendar', icon: Calendar }

/** Where the records live — history, current status and the full lists. */
export const RECORD_NAV: NavItem[] = [
  { label: 'Temps', to: '/temperatures', icon: Thermometer },
  { label: 'Food probe', to: '/food-probe', icon: Flame },
  { label: 'Deliveries', to: '/deliveries', icon: Package, badge: 'ordersToCheckIn' },
  { label: 'Suppliers', to: '/suppliers', icon: Truck },
  { label: 'Issues', to: '/food-safety', icon: ShieldAlert, badge: 'openIssues' },
  { label: 'Stock', to: '/stock', icon: ClipboardList },
  { label: 'Sign-off checklists', to: '/checklists', icon: ClipboardCheck },
]

export const TEAM_NAV: NavItem = { label: 'Team', to: '/team', icon: Users }

export const SETTINGS_NAV: NavItem = { label: 'Settings', to: '/settings', icon: Settings }

/** Ready-made sets of tasks to add to someone's list. Lives under More on phones. */
export const TEMPLATES_NAV: NavItem = { label: 'Task templates', to: '/templates', icon: LayoutTemplate }

/** Every reading for a day or week, with photos, for managers. Reached from Temperatures. */
export const REVIEW_NAV: NavItem = { label: 'Temperature review', to: '/temperatures/review', icon: CalendarRange }

/** Printable QR labels for equipment. Reached from Temperatures and Settings. */
export const QR_LABELS_NAV: NavItem = { label: 'QR labels', to: '/temperatures/labels', icon: QrCode }

/** Views inside Temperatures, shown as chips on the page rather than in the sidebar. */
export const TEMPERATURE_VIEWS: NavItem[] = [
  { label: 'All', to: '/temperatures/records', icon: Thermometer, end: true },
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
  CALENDAR_NAV,
  ...RECORD_NAV,
  TEAM_NAV,
  TEMPLATES_NAV,
  SETTINGS_NAV,
  QR_LABELS_NAV,
  REVIEW_NAV,
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
