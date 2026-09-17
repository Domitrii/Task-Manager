/**
 * Compliance rules.
 *
 * All pass/fail and overdue logic lives here so the same judgement is applied
 * in the dashboard, the section pages and the reports — and so the thresholds
 * can later be driven by a backend policy instead of local settings.
 */
import { format, isWithinInterval, parseISO } from 'date-fns'
import type {
  CheckOutcome,
  CheckPeriod,
  CheckPeriodWindow,
  Delivery,
  DeliveryLine,
  ISODate,
  ISODateTime,
  MonitoredItem,
  TemperatureLog,
  VenueSettings,
} from '@/data/types'

export const CHECK_PERIOD_ORDER: CheckPeriod[] = ['opening', 'midday', 'evening', 'closing']

/* -------------------------------------------------------------------------- */
/* Temperature evaluation                                                      */
/* -------------------------------------------------------------------------- */

/** Judges a reading against the item's own range. A missing bound never fails. */
export function evaluateTemperature(item: MonitoredItem, temperature: number): CheckOutcome {
  if (item.minTemp !== null && temperature < item.minTemp) return 'fail'
  if (item.maxTemp !== null && temperature > item.maxTemp) return 'fail'
  return 'pass'
}

/**
 * How close a reading sits to its limits, as a 0–1 ratio of the safe band.
 * Used to surface readings that passed but are drifting toward a limit.
 */
export function temperatureMargin(item: MonitoredItem, temperature: number): number | null {
  if (item.minTemp === null || item.maxTemp === null) return null
  const band = item.maxTemp - item.minTemp
  if (band <= 0) return null
  const distance = Math.min(temperature - item.minTemp, item.maxTemp - temperature)
  return distance / band
}

/** A passing reading within 12% of a limit is "borderline" — worth watching. */
export function isBorderline(item: MonitoredItem, log: TemperatureLog): boolean {
  if (log.outcome === 'fail') return false
  const margin = temperatureMargin(item, log.temperature)
  return margin !== null && margin < 0.12
}

export function formatRange(item: MonitoredItem): string {
  const { minTemp: min, maxTemp: max } = item
  if (min !== null && max !== null) return `${min}°C to ${max}°C`
  if (min !== null) return `${min}°C or above`
  if (max !== null) return `${max}°C or below`
  return 'No limit set'
}

/* -------------------------------------------------------------------------- */
/* Scheduled checks                                                            */
/* -------------------------------------------------------------------------- */

export type CheckSlotState = 'done' | 'failed' | 'due' | 'overdue' | 'upcoming'

export interface CheckSlot {
  item: MonitoredItem
  period: CheckPeriod
  window: CheckPeriodWindow
  state: CheckSlotState
  log?: TemperatureLog
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Resolves the start/end Date for a period window on a given calendar date. */
export function periodInterval(window: CheckPeriodWindow, date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  const [sh, sm] = window.startTime.split(':').map(Number)
  start.setHours(sh, sm, 0, 0)
  const end = new Date(date)
  const [eh, em] = window.endTime.split(':').map(Number)
  end.setHours(eh, em, 59, 999)
  // A closing window that runs past midnight belongs to the same trading day.
  if (end <= start) end.setDate(end.getDate() + 1)
  return { start, end }
}

export function periodForTime(windows: CheckPeriodWindow[], at: Date): CheckPeriod | undefined {
  const minutes = minutesSinceMidnight(at)
  const match = windows.find((window) => {
    const start = timeToMinutes(window.startTime)
    const end = timeToMinutes(window.endTime)
    return end >= start ? minutes >= start && minutes <= end : minutes >= start || minutes <= end
  })
  return match?.period
}

/**
 * Builds every scheduled check slot for a day, marking each as done, failed,
 * due (window open), overdue (window closed, nothing logged) or upcoming.
 */
export function buildCheckSlots(
  items: MonitoredItem[],
  logs: TemperatureLog[],
  settings: VenueSettings,
  now: Date,
): CheckSlot[] {
  const day = startOfDayLocal(now)
  const slots: CheckSlot[] = []

  for (const item of items) {
    if (!item.active) continue
    for (const period of item.requiredChecks) {
      const window = settings.periods.find((w) => w.period === period)
      if (!window) continue
      const { start, end } = periodInterval(window, day)
      const log = logs.find(
        (entry) =>
          entry.itemId === item.id &&
          isWithinInterval(parseISO(entry.recordedAt), { start, end }),
      )

      let state: CheckSlotState
      if (log) state = log.outcome === 'fail' ? 'failed' : 'done'
      else if (now > end) state = 'overdue'
      else if (now >= start) state = 'due'
      else state = 'upcoming'

      slots.push({ item, period, window, state, log })
    }
  }

  return slots.sort(
    (a, b) =>
      CHECK_PERIOD_ORDER.indexOf(a.period) - CHECK_PERIOD_ORDER.indexOf(b.period) ||
      a.item.name.localeCompare(b.item.name),
  )
}

export interface ComplianceSummary {
  required: number
  completed: number
  failed: number
  overdue: number
  due: number
  upcoming: number
  /** Completed (including failed — the check *was* done) over required, 0–100. */
  completionRate: number
}

export function summariseSlots(slots: CheckSlot[]): ComplianceSummary {
  const completed = slots.filter((s) => s.state === 'done' || s.state === 'failed').length
  return {
    required: slots.length,
    completed,
    failed: slots.filter((s) => s.state === 'failed').length,
    overdue: slots.filter((s) => s.state === 'overdue').length,
    due: slots.filter((s) => s.state === 'due').length,
    upcoming: slots.filter((s) => s.state === 'upcoming').length,
    completionRate: slots.length === 0 ? 100 : Math.round((completed / slots.length) * 100),
  }
}

/* -------------------------------------------------------------------------- */
/* Deliveries                                                                  */
/* -------------------------------------------------------------------------- */

/** Temperature limit that applies to a delivery line, if any. */
export function deliveryTempLimit(
  line: Pick<DeliveryLine, 'category'>,
  settings: VenueSettings,
): number | null {
  if (line.category === 'chilled' || line.category === 'produce' || line.category === 'bakery') {
    return settings.chilledDeliveryMaxTemp
  }
  if (line.category === 'frozen') return settings.frozenDeliveryMaxTemp
  return null
}

/** Flags a line that should not be accepted on temperature or packaging. */
export function deliveryLineConcern(
  line: DeliveryLine,
  settings: VenueSettings,
): string | null {
  const limit = deliveryTempLimit(line, settings)
  if (limit !== null && line.temperature !== null && line.temperature > limit) {
    return `Above ${limit}°C limit for ${line.category} goods`
  }
  if (line.packaging === 'damaged') return 'Packaging damaged'
  if (line.packaging === 'contaminated') return 'Packaging contaminated'
  return null
}

export function deriveDeliveryStatus(lines: DeliveryLine[]): Delivery['status'] {
  if (lines.length === 0) return 'accepted'
  const rejected = lines.filter((line) => !line.accepted).length
  if (rejected === 0) return 'accepted'
  if (rejected === lines.length) return 'rejected'
  return 'partially_rejected'
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

export function startOfDayLocal(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function isSameLocalDay(value: ISODateTime, date: Date): boolean {
  return toISODate(parseISO(value)) === toISODate(date)
}

/** Days until a use-by date; negative when already expired. */
export function daysUntil(value: ISODate, now: Date): number {
  const target = startOfDayLocal(parseISO(value)).getTime()
  const today = startOfDayLocal(now).getTime()
  return Math.round((target - today) / 86_400_000)
}
