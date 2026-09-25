/**
 * Turns a setup pack and a venue's answers into a fresh dataset.
 *
 * Everything is copied into new records with new ids. Nothing links back to
 * the pack, so changing a pack later never touches a venue that was already
 * set up. Logs, runs, deliveries, issues, tasks and stock all start empty.
 *
 * `planSetup` is the same work without the ids, so the preview can show
 * exactly what will be created and let the venue untick parts of it.
 */
import { createId, initialsOf } from '@/lib/utils'
import type { PackCondition, PackItem, SetupPack, UnitCategory } from './setupPacks'
import { DELIVERY_LIMITS } from './temperatureRanges'
import type {
  AppData,
  CheckPeriod,
  CheckPeriodWindow,
  ChecklistItemDef,
  ChecklistTemplate,
  MonitoredItem,
} from './types'

export interface SetupAnswers {
  venueName: string
  address: string
  /** Becomes the first team member, as manager. */
  managerName: string
  counts: Record<UnitCategory, number>
  /** Adds the pack's cooking and cooling probes. */
  cooksFromRaw: boolean
  /** `HH:mm`. A closing time at or before opening means the venue closes after midnight. */
  openingTime: string
  closingTime: string
  /** Plan keys unticked on the preview. */
  excluded: string[]
}

export const UNIT_CATEGORIES: UnitCategory[] = ['fridge', 'freezer', 'hot_holding']
export const MAX_UNITS = 20

/** The answers a pack suggests before the venue changes anything. */
export function packDefaults(
  pack: SetupPack,
): Pick<SetupAnswers, 'counts' | 'cooksFromRaw' | 'openingTime' | 'closingTime'> {
  return {
    counts: {
      fridge: pack.units.fridge.defaultCount,
      freezer: pack.units.freezer.defaultCount,
      hot_holding: pack.units.hot_holding.defaultCount,
    },
    cooksFromRaw: pack.cooksFromRawByDefault,
    openingTime: pack.hours.open,
    closingTime: pack.hours.close,
  }
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

export interface PlannedItem {
  key: string
  item: Omit<MonitoredItem, 'id'>
}

export interface PlannedChecklist {
  key: string
  template: Omit<ChecklistTemplate, 'id' | 'items'>
  items: Array<Omit<ChecklistItemDef, 'id'>>
}

export interface PlannedWindow {
  window: CheckPeriodWindow
  /** False when the venue isn't trading then, so nothing is scheduled in it. */
  inHours: boolean
}

export interface SetupPlan {
  items: PlannedItem[]
  checklists: PlannedChecklist[]
  periods: PlannedWindow[]
}

export function planSetup(pack: SetupPack, answers: SetupAnswers): SetupPlan {
  const periods = planWindows(pack, answers.openingTime, answers.closingTime)
  const closed = new Set(periods.filter((entry) => !entry.inHours).map((entry) => entry.window.period))
  const schedule = (checks: CheckPeriod[]) => checks.filter((period) => !closed.has(period))

  const items: PlannedItem[] = []
  for (const category of UNIT_CATEGORIES) {
    const unit = pack.units[category]
    const count = clampCount(answers.counts[category])
    for (let number = 1; number <= count; number += 1) {
      items.push({
        key: `${category}-${number}`,
        item: {
          name: `${unit.name} ${number}`,
          category,
          location: unit.location,
          minTemp: unit.minTemp,
          maxTemp: unit.maxTemp,
          requiredChecks: schedule(unit.requiredChecks),
          active: true,
          notes: unit.notes,
        },
      })
    }
  }
  for (const extra of pack.extras) {
    items.push({ key: `extra-${extra.key}`, item: copyItem(extra, schedule) })
  }
  if (answers.cooksFromRaw) {
    for (const probe of pack.probes) {
      items.push({ key: `probe-${probe.key}`, item: copyItem(probe, schedule) })
    }
  }

  // Checklist lines follow what will actually be created, so unticking every
  // hot-holding unit also drops "hot holding emptied" from closing.
  const excluded = new Set(answers.excluded)
  const conditions: Record<PackCondition, boolean> = {
    cooksFromRaw: answers.cooksFromRaw,
    hotHolding: items.some((entry) => entry.item.category === 'hot_holding' && !excluded.has(entry.key)),
  }

  const checklists: PlannedChecklist[] = pack.checklists
    .map((checklist) => ({
      key: `checklist-${checklist.key}`,
      template: {
        name: checklist.name,
        type: checklist.type,
        // A checklist in a window the venue isn't open for moves to closing.
        period: closed.has(checklist.period) ? 'closing' : checklist.period,
        area: checklist.area,
        active: true,
      },
      items: checklist.items
        .filter((item) => !item.when || conditions[item.when])
        .map((item) => ({ label: item.label, hint: item.hint, critical: item.critical })),
    }))
    .filter((checklist) => checklist.items.length > 0)

  return { items, checklists, periods }
}

function copyItem(entry: PackItem, schedule: (checks: CheckPeriod[]) => CheckPeriod[]): Omit<MonitoredItem, 'id'> {
  return {
    name: entry.name,
    category: entry.category,
    location: entry.location,
    minTemp: entry.minTemp,
    maxTemp: entry.maxTemp,
    requiredChecks: schedule(entry.requiredChecks),
    active: true,
    notes: entry.notes,
  }
}

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_UNITS, Math.max(0, Math.round(value))) : 0
}

/* -------------------------------------------------------------------------- */
/* Check windows                                                               */
/* -------------------------------------------------------------------------- */

const DAY = 24 * 60
/** Shortest midday or evening window worth keeping once trimmed to the trading day. */
const MIN_WINDOW = 30

/**
 * Fits the pack's windows to the venue's hours.
 *
 * - Opening and closing move with the hours, keeping the offset the pack set
 *   against its own hours (a pack that starts opening checks two hours before
 *   the doors open still does).
 * - Midday and evening keep their clock times, trimmed to sit between the end
 *   of opening and the start of closing.
 * - If trimming leaves less than `MIN_WINDOW`, the venue isn't trading then.
 *   The window keeps the pack's times so it can still be edited in Settings,
 *   but nothing is scheduled in it.
 *
 * Times are handled as minutes on the trading day, so a closing window that
 * runs past midnight stays after the one before it.
 */
export function planWindows(pack: SetupPack, openingTime: string, closingTime: string): PlannedWindow[] {
  const packDay = tradingDay(pack.hours.open, pack.hours.close)
  const day = isTime(openingTime) && isTime(closingTime) ? tradingDay(openingTime, closingTime) : packDay
  // Only closing can start after midnight: an early start there means late at night.
  const spans = new Map(
    pack.periods.map((window) => [window.period, toSpan(window, window.period === 'closing' ? packDay.open : 0)]),
  )
  const moved = (period: CheckPeriod, shift: number): [number, number] | undefined => {
    const span = spans.get(period)
    return span ? [span[0] + shift, span[1] + shift] : undefined
  }

  const opening = moved('opening', day.open - packDay.open)
  if (opening) opening[0] = Math.max(0, opening[0])

  const closing = moved('closing', day.close - packDay.close)
  // A window has to start before midnight to count for the trading day that
  // began that morning. Very late closers start closing checks at 23:30.
  if (closing && closing[0] >= DAY) closing[0] = DAY - MIN_WINDOW

  const serviceStart = opening?.[1] ?? day.open
  const serviceEnd = closing?.[0] ?? day.close

  return pack.periods.map((window): PlannedWindow => {
    if (window.period === 'opening' && opening) return { window: withSpan(window, opening), inHours: true }
    if (window.period === 'closing' && closing) return { window: withSpan(window, closing), inHours: true }

    const [start, end] = spans.get(window.period) ?? [0, 0]
    const trimmed: [number, number] = [Math.max(start, serviceStart), Math.min(end, serviceEnd)]
    return trimmed[1] - trimmed[0] >= MIN_WINDOW
      ? { window: withSpan(window, trimmed), inHours: true }
      : { window: { ...window }, inHours: false }
  })
}

function isTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value)
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function toTime(minutes: number): string {
  const wrapped = ((minutes % DAY) + DAY) % DAY
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/** A closing time at or before opening means the venue closes after midnight. */
function tradingDay(open: string, close: string): { open: number; close: number } {
  const start = toMinutes(open)
  const end = toMinutes(close)
  return { open: start, close: end <= start ? end + DAY : end }
}

/** A window as minutes on the trading day. Starts before `earliest` fall after midnight. */
function toSpan(window: CheckPeriodWindow, earliest: number): [number, number] {
  let start = toMinutes(window.startTime)
  if (start < earliest) start += DAY
  let end = toMinutes(window.endTime)
  while (end <= start) end += DAY
  return [start, end]
}

function withSpan(window: CheckPeriodWindow, [start, end]: [number, number]): CheckPeriodWindow {
  return { period: window.period, label: window.label, startTime: toTime(start), endTime: toTime(end) }
}

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

export function buildDataFromSetupPack(pack: SetupPack, answers: SetupAnswers, now: Date = new Date()): AppData {
  const plan = planSetup(pack, answers)
  const excluded = new Set(answers.excluded)
  const managerName = answers.managerName.trim()

  return {
    staff: [
      { id: createId('st'), name: managerName, role: 'manager', initials: initialsOf(managerName), active: true },
    ],
    items: plan.items
      .filter((entry) => !excluded.has(entry.key))
      .map((entry) => ({ ...entry.item, id: createId('eq'), requiredChecks: [...entry.item.requiredChecks] })),
    checklistTemplates: plan.checklists
      .filter((entry) => !excluded.has(entry.key))
      .map((entry) => ({
        ...entry.template,
        id: createId('ct'),
        items: entry.items.map((item) => ({ ...item, id: createId('ci') })),
      })),
    temperatureLogs: [],
    suppliers: [],
    deliveries: [],
    checklistRuns: [],
    issues: [],
    stock: [],
    tasks: [],
    settings: {
      venueName: answers.venueName.trim(),
      siteReference: '',
      address: answers.address.trim(),
      temperatureUnit: 'C',
      periods: plan.periods.map((entry) => ({ ...entry.window })),
      chilledDeliveryMaxTemp: DELIVERY_LIMITS.chilled,
      frozenDeliveryMaxTemp: DELIVERY_LIMITS.frozen,
      recordsStartAt: now.toISOString(),
    },
  }
}
