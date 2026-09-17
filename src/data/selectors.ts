/**
 * Derived views over `AppData`.
 *
 * Pure functions of (data, now) so the dashboard, sidebar counters and reports
 * all agree on what "overdue today" means.
 */
import { isAfter, parseISO, subDays } from 'date-fns'
import {
  buildCheckSlots,
  daysUntil,
  isSameLocalDay,
  periodInterval,
  startOfDayLocal,
  summariseSlots,
  toISODate,
  type CheckSlot,
} from '@/lib/compliance'
import type {
  AppData,
  ChecklistTemplate,
  Delivery,
  FoodSafetyIssue,
  ID,
  MonitoredCategory,
  MonitoredItem,
  StaffMember,
  StockItem,
  Task,
  TemperatureLog,
} from './types'

export function indexById<T extends { id: ID }>(list: T[]): Map<ID, T> {
  return new Map(list.map((entity) => [entity.id, entity]))
}

export function staffName(data: AppData, id: ID | undefined): string {
  if (!id) return 'Unassigned'
  return data.staff.find((person) => person.id === id)?.name ?? 'Unknown'
}

export function staffMember(data: AppData, id: ID | undefined): StaffMember | undefined {
  return data.staff.find((person) => person.id === id)
}

export function itemName(data: AppData, id: ID): string {
  return data.items.find((item) => item.id === id)?.name ?? 'Unknown item'
}

/* -------------------------------------------------------------------------- */
/* Temperature                                                                 */
/* -------------------------------------------------------------------------- */

export function selectTodaySlots(data: AppData, now: Date): CheckSlot[] {
  return buildCheckSlots(data.items, data.temperatureLogs, data.settings, now)
}

export function selectLogsForDay(data: AppData, day: Date): TemperatureLog[] {
  return data.temperatureLogs.filter((log) => isSameLocalDay(log.recordedAt, day))
}

export function selectLogsForCategories(
  data: AppData,
  categories: MonitoredCategory[],
): TemperatureLog[] {
  const ids = new Set(data.items.filter((item) => categories.includes(item.category)).map((item) => item.id))
  return data.temperatureLogs.filter((log) => ids.has(log.itemId))
}

export function selectItemsForCategories(
  data: AppData,
  categories: MonitoredCategory[],
): MonitoredItem[] {
  return data.items
    .filter((item) => categories.includes(item.category))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The most recent reading per item, newest first — the "current state" view. */
export function selectLatestReadings(
  data: AppData,
  items: MonitoredItem[],
): Array<{ item: MonitoredItem; log?: TemperatureLog }> {
  return items.map((item) => ({
    item,
    log: data.temperatureLogs.find((log) => log.itemId === item.id),
  }))
}

/* -------------------------------------------------------------------------- */
/* Deliveries                                                                  */
/* -------------------------------------------------------------------------- */

export function selectDeliveriesForDay(data: AppData, day: Date): Delivery[] {
  return data.deliveries.filter((delivery) => isSameLocalDay(delivery.receivedAt, day))
}

export function selectRecentDeliveries(data: AppData, limit: number): Delivery[] {
  return data.deliveries.slice(0, limit)
}

export function selectRejectedDeliveries(data: AppData, sinceDays: number, now: Date): Delivery[] {
  const cutoff = subDays(startOfDayLocal(now), sinceDays)
  return data.deliveries.filter(
    (delivery) => delivery.status !== 'accepted' && isAfter(parseISO(delivery.receivedAt), cutoff),
  )
}

/** How long an expired line stays on the watch list before it is assumed gone. */
const EXPIRED_GRACE_DAYS = 2

/**
 * Accepted delivery lines approaching their use-by date.
 *
 * Bounded at both ends: something that expired a fortnight ago has long since
 * been used or binned, and keeping it here would bury the handful of lines that
 * actually need looking at today.
 */
export function selectExpiringStock(
  data: AppData,
  withinDays: number,
  now: Date,
): Array<{ delivery: Delivery; line: Delivery['lines'][number]; daysLeft: number }> {
  const results: Array<{ delivery: Delivery; line: Delivery['lines'][number]; daysLeft: number }> = []
  for (const delivery of data.deliveries) {
    for (const line of delivery.lines) {
      if (!line.accepted || !line.useBy) continue
      const daysLeft = daysUntil(line.useBy, now)
      if (daysLeft <= withinDays && daysLeft >= -EXPIRED_GRACE_DAYS) {
        results.push({ delivery, line, daysLeft })
      }
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft)
}

/* -------------------------------------------------------------------------- */
/* Checklists                                                                  */
/* -------------------------------------------------------------------------- */

export interface ChecklistStatus {
  template: ChecklistTemplate
  run?: AppData['checklistRuns'][number]
  state: 'complete' | 'issues' | 'due' | 'overdue' | 'upcoming'
  failedCount: number
}

export function selectChecklistStatus(
  data: AppData,
  now: Date,
  types?: ChecklistTemplate['type'][],
): ChecklistStatus[] {
  const today = toISODate(now)
  return data.checklistTemplates
    .filter((template) => template.active && (!types || types.includes(template.type)))
    .map((template) => {
      const run = data.checklistRuns.find(
        (entry) => entry.templateId === template.id && entry.date === today,
      )
      const failedCount = run ? run.results.filter((result) => result.status === 'fail').length : 0
      const window = data.settings.periods.find((period) => period.period === template.period)
      const interval = window ? periodInterval(window, now) : undefined

      let state: ChecklistStatus['state']
      if (run) state = failedCount > 0 ? 'issues' : 'complete'
      else if (!interval) state = 'due'
      else if (now > interval.end) state = 'overdue'
      else if (now >= interval.start) state = 'due'
      else state = 'upcoming'

      return { template, run, state, failedCount }
    })
}

/* -------------------------------------------------------------------------- */
/* Issues, tasks, stock                                                        */
/* -------------------------------------------------------------------------- */

export function selectOpenIssues(data: AppData): FoodSafetyIssue[] {
  return data.issues.filter((issue) => issue.status !== 'resolved')
}

export function selectOutstandingTasks(data: AppData): Task[] {
  return data.tasks.filter((task) => task.status !== 'done')
}

export function selectOverdueTasks(data: AppData, now: Date): Task[] {
  return data.tasks.filter(
    (task) => task.status !== 'done' && task.dueAt !== undefined && parseISO(task.dueAt) < now,
  )
}

export function selectLowStock(data: AppData): StockItem[] {
  return data.stock
    .filter((item) => item.quantity <= item.parLevel)
    .sort((a, b) => a.quantity / a.parLevel - b.quantity / b.parLevel)
}

/* -------------------------------------------------------------------------- */
/* Dashboard roll-up                                                           */
/* -------------------------------------------------------------------------- */

export interface DashboardSummary {
  slots: CheckSlot[]
  checks: ReturnType<typeof summariseSlots>
  adHocToday: number
  failedLogsToday: TemperatureLog[]
  deliveriesToday: Delivery[]
  rejectedRecently: Delivery[]
  openIssues: FoodSafetyIssue[]
  highSeverityIssues: FoodSafetyIssue[]
  outstandingTasks: Task[]
  overdueTasks: Task[]
  lowStock: StockItem[]
  checklists: ChecklistStatus[]
  /**
   * Share of all required daily activity that is complete, 0–100, or `null`
   * before the first check window of the day opens — at 04:00 nothing is yet
   * required, and reporting that as 100% would read as a clean bill of health.
   */
  overallCompliance: number | null
}

export function selectDashboard(data: AppData, now: Date): DashboardSummary {
  const slots = selectTodaySlots(data, now)
  const checks = summariseSlots(slots)
  const todayLogs = selectLogsForDay(data, now)
  const checklists = selectChecklistStatus(data, now)

  const checklistsDone = checklists.filter((entry) => entry.state === 'complete' || entry.state === 'issues').length
  const checklistsRequired = checklists.filter((entry) => entry.state !== 'upcoming').length
  const requiredTotal = checks.required - checks.upcoming + checklistsRequired
  const completedTotal = checks.completed + checklistsDone

  return {
    slots,
    checks,
    adHocToday: todayLogs.filter((log) => !log.period).length,
    failedLogsToday: todayLogs.filter((log) => log.outcome === 'fail'),
    deliveriesToday: selectDeliveriesForDay(data, now),
    rejectedRecently: selectRejectedDeliveries(data, 7, now),
    openIssues: selectOpenIssues(data),
    highSeverityIssues: selectOpenIssues(data).filter((issue) => issue.severity === 'high'),
    outstandingTasks: selectOutstandingTasks(data),
    overdueTasks: selectOverdueTasks(data, now),
    lowStock: selectLowStock(data),
    checklists,
    overallCompliance: requiredTotal === 0 ? null : Math.round((completedTotal / requiredTotal) * 100),
  }
}

/** Per-day pass/fail counts for the last `days` days, oldest first. */
export function selectComplianceTrend(
  data: AppData,
  days: number,
  now: Date,
): Array<{ date: string; label: string; passed: number; failed: number; rate: number }> {
  const results: Array<{ date: string; label: string; passed: number; failed: number; rate: number }> = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = subDays(now, offset)
    const logs = selectLogsForDay(data, day)
    const failed = logs.filter((log) => log.outcome === 'fail').length
    const passed = logs.length - failed
    results.push({
      date: toISODate(day),
      label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      passed,
      failed,
      rate: logs.length === 0 ? 100 : Math.round((passed / logs.length) * 100),
    })
  }
  return results
}
