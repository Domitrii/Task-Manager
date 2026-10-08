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

export type TaskCategory = 'maintenance' | 'compliance' | 'admin' | 'prep' | 'training'

export interface Task {
  id: ID
  title: string
  description?: string
  assigneeId?: ID
  dueAt?: ISODateTime
  priority: TaskPriority
  status: TaskStatus
  category: TaskCategory
  createdAt: ISODateTime
  completedAt?: ISODateTime
  /** What whoever does the task has to answer. Copied from a template, so editing either never changes the other. */
  questions?: TaskQuestion[]
  /** Keyed by question id. Answers to questions since removed are kept but ignored. */
  answers?: Record<ID, TaskAnswer>
  /** The template this task was added from, when it was. */
  templateId?: ID
}

/* -------------------------------------------------------------------------- */
/* Task templates — ready-made sets of tasks to add to someone's list          */
/* -------------------------------------------------------------------------- */

export type QuestionType = 'options' | 'text' | 'number' | 'check'

/** What choosing an option asks of the person answering. */
export type OptionAction = 'none' | 'request' | 'require'

export interface QuestionOption {
  id: ID
  label: string
  /** Counted only when the question has `scored` on. */
  score: number
  /** Choosing this option marks the answer as an exception, e.g. "No" to "Is the probe calibrated?". */
  exception: boolean
  /** `request` offers a note on what was done about it; `require` won't complete without one. */
  action: OptionAction
}

/**
 * Team data a template question is filled from. It's resolved each time a task
 * is created from the template, so the task always matches the team's current
 * equipment, staff and suppliers, not whatever they were when it was added.
 */
export type QuestionSource =
  /** A number question asked once for each active item in these categories, with that item's own safe range. */
  | { kind: 'equipment'; categories: MonitoredCategory[] }
  /** An options question whose options are the team's active staff. */
  | { kind: 'staff' }
  /** An options question whose options are the team's active suppliers. */
  | { kind: 'suppliers' }

export interface TaskQuestion {
  id: ID
  label: string
  /** Guidance shown under the question while answering. */
  hint?: string
  type: QuestionType
  /** Must be answered before the task can be completed. */
  mandatory: boolean
  /** `options` only. */
  options: QuestionOption[]
  /** `options` only: a row of buttons, or a dropdown for long lists. */
  display: 'buttons' | 'dropdown'
  /** `options` only: add up option scores into a score for the task. */
  scored: boolean
  /** `number` only, e.g. "°C" or "kg". */
  unit?: string
  /** `number` only: answers outside this inclusive range are exceptions. */
  min?: number
  max?: number
  /** Templates only. With no matching team data, the question is asked as written. */
  source?: QuestionSource
  /** On a task, the piece of equipment a reading made from `source` is for. */
  itemId?: ID
}

export interface TaskAnswer {
  /** Option id, the typed text or number, or `'true'` for a ticked check. */
  value: string
  /** What was done about an exception. */
  note?: string
}

export interface TemplateTask {
  id: ID
  title: string
  description?: string
  category: TaskCategory
  priority: TaskPriority
  questions: TaskQuestion[]
}

export interface TaskTemplate {
  id: ID
  name: string
  /** One emoji, shown beside the name. */
  icon?: string
  /** When in the day it's done, e.g. "Before open" or "Ad hoc". Templates are listed under these. */
  group: string
  /** How often it's meant to happen, in words, e.g. "Every day in Open". */
  schedule?: string
  tags: string[]
  tasks: TemplateTask[]
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
  /**
   * When this venue started keeping records in the app. Check windows that
   * closed before it aren't counted as missed, so a venue set up this afternoon
   * isn't marked down for this morning or last week. Absent means no cut-off.
   */
  recordsStartAt?: ISODateTime
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
  taskTemplates: TaskTemplate[]
  settings: VenueSettings
}
