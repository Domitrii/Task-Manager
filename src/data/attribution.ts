/**
 * Who entered a record, when that's worth saying. A record goes down in the
 * name of whoever did the job at the time they did it; only a manager can put
 * it in someone else's name or at an earlier time, and when they do, the record
 * says so.
 */
import { format, isSameDay, parseISO } from 'date-fns'
import { staffName } from './selectors'
import type { AppData, ID, ISODateTime } from './types'

/** Entered this long after the time it's for, it says when it was entered. */
const LATE_MINUTES = 15

export interface EnteredRecord {
  enteredBy?: ID
  enteredAt?: ISODateTime
}

/** Whoever entered it, when that isn't who it's down for. */
export function enteredByOther(data: AppData, record: EnteredRecord, by: ID): string | null {
  return record.enteredBy && record.enteredBy !== by ? staffName(data, record.enteredBy) : null
}

/** "entered by Tom, 14:05", "entered 14:05", or null when it went in as it happened. */
export function enteredNote(data: AppData, record: EnteredRecord, by: ID, at: ISODateTime): string | null {
  const parts: string[] = []
  const other = enteredByOther(data, record, by)
  if (other) parts.push(`by ${other}`)
  if (record.enteredAt && Date.parse(record.enteredAt) - Date.parse(at) > LATE_MINUTES * 60_000) {
    const entered = parseISO(record.enteredAt)
    parts.push(format(entered, isSameDay(entered, parseISO(at)) ? 'HH:mm' : 'd MMM HH:mm'))
  }
  return parts.length > 0 ? `entered ${parts.join(', ')}` : null
}
