/**
 * Reminders someone sets for themselves: a time to go through everything. Each
 * one is worked out from the clock rather than stored as an event, so a device
 * that was closed at the time still knows it went off.
 */
import { format, parseISO } from 'date-fns'
import { toISODate } from '@/lib/compliance'
import type { Reminder } from './types'

/** Monday first, like the rest of the app. The numbers match `Date.getDay()`. */
export const WEEK_DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]

export const EVERY_DAY = WEEK_DAYS.map(({ day }) => day)

/** What a reminder says when its owner hasn't written anything more specific. */
export const DEFAULT_REMINDER_TITLE = 'Check all the details'

const momentOf = (date: string, time: string) => parseISO(`${date}T${time}`)

/** When it went off today, if it has. It won't go off for a time already past when it was set. */
export function wentOffToday(reminder: Reminder, now: Date): Date | null {
  if (!reminder.on) return null
  const today = toISODate(now)
  if (reminder.date ? reminder.date !== today : !reminder.days.includes(now.getDay())) return null
  const at = momentOf(today, reminder.time)
  return at <= now && at >= parseISO(reminder.setAt) ? at : null
}

/** A one-off whose time has come has nothing left to do. */
export function isFinished(reminder: Pick<Reminder, 'date' | 'time'>, now: Date): boolean {
  return reminder.date !== undefined && momentOf(reminder.date, reminder.time) <= now
}

/** A one-off past its day can go for good. On the day itself it's still showing in the bell. */
export function isExpired(reminder: Reminder, now: Date): boolean {
  return reminder.date !== undefined && reminder.date < toISODate(now)
}

/** When it repeats, in words. */
export function reminderSchedule(reminder: Pick<Reminder, 'days' | 'date'>): string {
  if (reminder.date) return `Once · ${format(parseISO(reminder.date), 'EEE d MMM yyyy')}`
  if (reminder.days.length === EVERY_DAY.length) return 'Every day'
  return WEEK_DAYS.filter(({ day }) => reminder.days.includes(day))
    .map(({ label }) => label)
    .join(', ')
}
