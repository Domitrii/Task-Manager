/** Rules for typing a reading, shared by the Log sheet, the scan page and changing a reading. */
import { format } from 'date-fns'
import type { MonitoredItem } from '@/data/types'

/** Freezers read below zero, so their entry starts negative. */
export function startsNegative(item: MonitoredItem | undefined): boolean {
  return item?.maxTemp !== null && item?.maxTemp !== undefined && item.maxTemp <= 0
}

/** The typed digits and sign as a number, or `NaN` while nothing usable is typed. */
export function readingValue(digits: string, negative: boolean): number {
  return digits === '' || digits === '.' ? Number.NaN : (negative ? -1 : 1) * Number(digits)
}

/** A saved reading as the digits and sign it would have been typed with. */
export function readingDigits(temperature: number): { digits: string; negative: boolean } {
  return { digits: String(Math.abs(temperature)), negative: temperature < 0 }
}

/** `datetime-local` wants a local, second-less string — not an ISO UTC stamp. */
export function toLocalInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}
