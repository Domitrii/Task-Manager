/** Rules for typing a reading, shared by the Log sheet and the scan page. */
import type { MonitoredItem } from '@/data/types'

/** Freezers read below zero, so their entry starts negative. */
export function startsNegative(item: MonitoredItem | undefined): boolean {
  return item?.maxTemp !== null && item?.maxTemp !== undefined && item.maxTemp <= 0
}

/** The typed digits and sign as a number, or `NaN` while nothing usable is typed. */
export function readingValue(digits: string, negative: boolean): number {
  return digits === '' || digits === '.' ? Number.NaN : (negative ? -1 : 1) * Number(digits)
}
