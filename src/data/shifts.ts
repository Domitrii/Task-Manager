/** What a shift's times mean, for the Calendar and for clocking in and out. */
import { addDays, differenceInMinutes, format, parseISO } from 'date-fns'
import { toISODate } from '@/lib/compliance'
import type { AppData, ClockTime, ID, ISODate, Shift, ShiftBreak, Unavailability } from './types'

export type ShiftState = 'scheduled' | 'clocked-in' | 'complete'

export const DAY_MINUTES = 24 * 60

export function shiftState(shift: Shift): ShiftState {
  if (shift.clockedOutAt) return 'complete'
  return shift.clockedInAt ? 'clocked-in' : 'scheduled'
}

/** "08:30" as minutes into the day. */
export function toMinutes(time: ClockTime): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Minutes into the day as "08:30". Anything past midnight wraps round to the next day's time. */
export function toClockTime(minutes: number): ClockTime {
  const wrapped = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/** When a shift is due to start and finish. One ending earlier than it starts finishes the next day. */
export function shiftWindow(shift: Pick<Shift, 'date' | 'startTime' | 'endTime'>): { start: Date; end: Date } {
  const start = new Date(`${shift.date}T${shift.startTime}:00`)
  const end = new Date(`${shift.date}T${shift.endTime}:00`)
  return { start, end: end <= start ? addDays(end, 1) : end }
}

/** Starting late is fine, starting early isn't. Ending has no such limit. */
export function canClockIn(shift: Shift, now: Date): boolean {
  return shiftState(shift) === 'scheduled' && now >= shiftWindow(shift).start
}

/** The break someone's on now, if any. */
export function currentBreak(shift: Shift): ShiftBreak | undefined {
  return shift.breaks?.find((entry) => !entry.endedAt)
}

export function onBreak(shift: Shift): boolean {
  return currentBreak(shift) !== undefined
}

/** The shift's breaks, with any still running ended at `at`. */
export function closeBreaks(shift: Shift, at: Date): ShiftBreak[] | undefined {
  return shift.breaks?.map((entry) => (entry.endedAt ? entry : { ...entry, endedAt: at.toISOString() }))
}

const breakLength = (entry: ShiftBreak, at: Date) =>
  (entry.endedAt ? Date.parse(entry.endedAt) : at.getTime()) - Date.parse(entry.startedAt)

/** Milliseconds on break so far, up to `at` for a break still running. */
export function breakMs(shift: Shift, at: Date): number {
  return (shift.breaks ?? []).reduce((total, entry) => total + breakLength(entry, at), 0)
}

/** Milliseconds worked: time since clocking in, up to clocking out, less breaks. */
export function workedMs(shift: Shift, at: Date): number {
  if (!shift.clockedInAt) return 0
  const until = shift.clockedOutAt ? Date.parse(shift.clockedOutAt) : at.getTime()
  return Math.max(0, until - Date.parse(shift.clockedInAt) - breakMs(shift, at))
}

/** "02:14:07": a running clock. */
export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}

/** "1h 43": hours and two-digit minutes. */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes))
  return `${Math.floor(whole / 60)}h ${String(whole % 60).padStart(2, '0')}`
}

export function minutesBetween(from: string, to: Date | string): number {
  return differenceInMinutes(typeof to === 'string' ? parseISO(to) : to, parseISO(from))
}

export const shiftHours = (shift: Pick<Shift, 'startTime' | 'endTime'>) => `${shift.startTime}–${shift.endTime}`

export function shiftsFor(data: AppData, staffId: ID): Shift[] {
  return data.shifts.filter((shift) => shift.staffId === staffId)
}

export function shiftsOn(data: AppData, staffId: ID, date: ISODate): Shift[] {
  return shiftsFor(data, staffId)
    .filter((shift) => shift.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/**
 * The shift someone could be clocking in or out of now. The one they're on;
 * otherwise, of the ones not started, the one that should be under way (a
 * night shift from yesterday counts), then today's next, then one they've
 * missed today, which they can still start late. Failing all that, today's last.
 */
export function currentShift(data: AppData, staffId: ID, now: Date): Shift | undefined {
  const mine = shiftsFor(data, staffId)
  const running = mine.find((shift) => shiftState(shift) === 'clocked-in')
  if (running) return running

  const today = toISODate(now)
  const notStarted = mine
    .filter((shift) => shiftState(shift) === 'scheduled')
    .map((shift) => ({ shift, ...shiftWindow(shift) }))
    .filter(({ shift, start, end }) => shift.date === today || (start <= now && now < end))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const underWay = notStarted.filter(({ start, end }) => start <= now && now < end).at(-1)
  const next = notStarted.find(({ start }) => start > now)
  const open = underWay ?? next ?? notStarted.at(-1)
  return open?.shift ?? shiftsOn(data, staffId, today).at(-1)
}

export function unavailabilityOn(data: AppData, staffId: ID, date: ISODate): Unavailability | undefined {
  return data.unavailability.find(
    (entry) => entry.staffId === staffId && entry.startDate <= date && entry.endDate >= date,
  )
}

export function unavailabilityHours(entry: Unavailability): string {
  return entry.allDay ? 'All day' : `${entry.startTime}–${entry.endTime}`
}

/** The seven days of a week, Monday first. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

/** "19–25 October 2026", or "28 October – 3 November 2026" across two months. */
export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  if (monday.getMonth() === sunday.getMonth()) return `${format(monday, 'd')}–${format(sunday, 'd MMMM yyyy')}`
  if (monday.getFullYear() === sunday.getFullYear()) return `${format(monday, 'd MMMM')} – ${format(sunday, 'd MMMM yyyy')}`
  return `${format(monday, 'd MMMM yyyy')} – ${format(sunday, 'd MMMM yyyy')}`
}
