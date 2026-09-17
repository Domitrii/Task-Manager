/**
 * Domain model for Mise.
 *
 * Everything the app shows is derived from these records. They are intentionally
 * flat and id-linked (rather than nested) so that the local demo repository can
 * later be swapped for a REST/GraphQL backend without reshaping the UI — see
 * `data/repository.ts`.
 */

export type ID = string
/** ISO-8601 timestamp, e.g. `2026-09-17T08:12:00.000Z`. */
export type ISODateTime = string
/** Calendar date, `YYYY-MM-DD`, in the venue's local timezone. */
export type ISODate = string

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

export type StaffRole = 'manager' | 'head_chef' | 'chef' | 'supervisor' | 'front_of_house' | 'kp'

export interface StaffMember {
  id: ID
  name: string
  role: StaffRole
  /** Shown in avatars when no photo is available. */
  initials: string
  active: boolean
  /** Optional 4-digit sign-off PIN. Not security — it mirrors real venue practice. */
  pin?: string
}

/* -------------------------------------------------------------------------- */
/* Monitored items (equipment + probed food)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Both physical equipment (a fridge) and probed food (a cooked dish) are
 * "monitored items". They share one record shape because every temperature
 * reading answers the same question: was this within its safe range?
 */
export type MonitoredCategory =
  | 'fridge'
  | 'freezer'
  | 'display_fridge'
  | 'hot_holding'
  | 'cooking'
  | 'cooling'

/** Named slots in the trading day. Windows are configured in settings. */
export type CheckPeriod = 'opening' | 'midday' | 'evening' | 'closing'

export interface MonitoredItem {
  id: ID
  name: string
  category: MonitoredCategory
  location: string
  /** Inclusive lower bound in °C. `null` means "no lower limit". */
  minTemp: number | null
  /** Inclusive upper bound in °C. `null` means "no upper limit". */
  maxTemp: number | null
  /**
   * Periods this item must be checked in each day. Empty means the item is
   * checked ad-hoc (cooking probes happen per batch, not on a timetable).
   */
  requiredChecks: CheckPeriod[]
  active: boolean
  /** Asset tag / model, purely informational. */
  reference?: string
  notes?: string
}

export type CheckOutcome = 'pass' | 'fail'

export interface TemperatureLog {
  id: ID
  itemId: ID
  temperature: number
  recordedAt: ISODateTime
  recordedBy: ID
  outcome: CheckOutcome
  /** Which scheduled slot this reading satisfies; absent for ad-hoc readings. */
  period?: CheckPeriod
  /** Required whenever `outcome` is `fail`. */
  correctiveAction?: string
  notes?: string
}

/* -------------------------------------------------------------------------- */
/* Deliveries                                                                  */
/* -------------------------------------------------------------------------- */

export interface Supplier {
  id: ID
  name: string
  /** What they typically deliver — drives sensible defaults on the form. */
  categories: DeliveryLineCategory[]
  contactName?: string
  phone?: string
  active: boolean
}

export type DeliveryLineCategory = 'chilled' | 'frozen' | 'ambient' | 'produce' | 'bakery' | 'non_food'

export type PackagingCondition = 'good' | 'damaged' | 'contaminated'

export type DeliveryStatus = 'accepted' | 'partially_rejected' | 'rejected'

export interface DeliveryLine {
  id: ID
  product: string
  category: DeliveryLineCategory
  quantity: number
  unit: string
  /** °C at the point of receipt. `null` for ambient/non-food goods. */
  temperature: number | null
  packaging: PackagingCondition
  useBy?: ISODate
  bestBefore?: ISODate
  accepted: boolean
  rejectionReason?: string
}

export interface Delivery {
  id: ID
  supplierId: ID
  receivedAt: ISODateTime
  checkedBy: ID
  status: DeliveryStatus
  lines: DeliveryLine[]
  deliveryNote?: string
  driverName?: string
  /** Was the delivery vehicle at the right temperature on arrival? */
  vehicleTempOk?: boolean
  notes?: string
}

/* -------------------------------------------------------------------------- */
/* Checklists — food safety, cleaning, opening & closing                       */
/* -------------------------------------------------------------------------- */

export type ChecklistType = 'opening' | 'closing' | 'food_safety' | 'cleaning'

export interface ChecklistItemDef {
  id: ID
  label: string
  /** Optional guidance shown under the label while completing the run. */
  hint?: string
  /** A failed critical item raises a food-safety issue automatically. */
  critical: boolean
}

export interface ChecklistTemplate {
  id: ID
  name: string
  type: ChecklistType
  /** Which slot of the day this run belongs to. */
  period: CheckPeriod
  area?: string
  items: ChecklistItemDef[]
  active: boolean
}

export type ChecklistResultStatus = 'pass' | 'fail' | 'na'

export interface ChecklistResult {
  itemId: ID
  status: ChecklistResultStatus
  note?: string
}

export interface ChecklistRun {
  id: ID
  templateId: ID
  date: ISODate
  completedBy: ID
  completedAt: ISODateTime
  results: ChecklistResult[]
  notes?: string
}

/* -------------------------------------------------------------------------- */
/* Food safety issues                                                          */
/* -------------------------------------------------------------------------- */

export type IssueSeverity = 'low' | 'medium' | 'high'
export type IssueStatus = 'open' | 'in_progress' | 'resolved'
export type IssueSource = 'temperature' | 'delivery' | 'checklist' | 'manual'

export interface FoodSafetyIssue {
  id: ID
  title: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  source: IssueSource
  raisedAt: ISODateTime
  raisedBy: ID
  assigneeId?: ID
  /** Id of the log/delivery/run that triggered this issue, when automatic. */
  linkedRecordId?: ID
  resolution?: string
  resolvedAt?: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Stock                                                                       */
/* -------------------------------------------------------------------------- */

export type StockCategory = 'meat' | 'fish' | 'dairy' | 'produce' | 'dry' | 'frozen' | 'drinks' | 'packaging'

export interface StockItem {
  id: ID
  name: string
  category: StockCategory
  unit: string
  quantity: number
  /** Reorder threshold. At or below this, the item is flagged as low. */
  parLevel: number
  location: string
  supplierId?: ID
  costPerUnit?: number
  lastCountedAt?: ISODateTime
  lastCountedBy?: ID
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                       */
/* -------------------------------------------------------------------------- */

export type TaskPriority = 'low' | 'normal' | 'high'
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
  id: ID
  title: string
  description?: string
  assigneeId?: ID
  dueAt?: ISODateTime
  priority: TaskPriority
  status: TaskStatus
  category: 'maintenance' | 'compliance' | 'admin' | 'prep' | 'training'
  createdAt: ISODateTime
  completedAt?: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export interface CheckPeriodWindow {
  period: CheckPeriod
  label: string
  /** `HH:mm`, venue-local. A check counts for this period if logged inside it. */
  startTime: string
  endTime: string
}

export interface VenueSettings {
  venueName: string
  siteReference: string
  address: string
  temperatureUnit: 'C'
  periods: CheckPeriodWindow[]
  /** Deliveries chilled above this are flagged for rejection. */
  chilledDeliveryMaxTemp: number
  /** Deliveries frozen above this are flagged for rejection. */
  frozenDeliveryMaxTemp: number
}

/* -------------------------------------------------------------------------- */
/* Aggregate                                                                   */
/* -------------------------------------------------------------------------- */

export interface AppData {
  staff: StaffMember[]
  items: MonitoredItem[]
  temperatureLogs: TemperatureLog[]
  suppliers: Supplier[]
  deliveries: Delivery[]
  checklistTemplates: ChecklistTemplate[]
  checklistRuns: ChecklistRun[]
  issues: FoodSafetyIssue[]
  stock: StockItem[]
  tasks: Task[]
  settings: VenueSettings
}
