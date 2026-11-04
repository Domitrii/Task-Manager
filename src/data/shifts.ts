/** What a shift's times mean, for the Calendar and for clocking in and out. */
import { addDays, differenceInMinutes, format, parseISO } from 'date-fns'
import { toISODate } from '@/lib/compliance'
import type { AppData, ID, ISODate, Shift, Unavailability } from './types'

export type ShiftState = 'scheduled' | 'clocked-in' | 'complete'

export function shiftState(shift: Shift): ShiftState {
  if (shift.clockedOutAt) return 'complete'
  return shift.clockedInAt ? 'clocked-in' : 'scheduled'
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

/** The shift someone could be clocking in or out of now: one they're on, or today's next. */
export function currentShift(data: AppData, staffId: ID, now: Date): Shift | undefined {
  const mine = shiftsFor(data, staffId)
  const running = mine.find((shift) => shiftState(shift) === 'clocked-in')
  if (running) return running
  const today = shiftsOn(data, staffId, toISODate(now))
  return today.find((shift) => shiftState(shift) === 'scheduled') ?? today[today.length - 1]
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
