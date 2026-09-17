import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from 'date-fns'
import type { ISODate, ISODateTime } from '@/data/types'

export function formatTemp(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  // One decimal only when it carries information; probes report to 0.1°C.
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}°C`
}

export function formatTime(value: ISODateTime): string {
  return format(parseISO(value), 'HH:mm')
}

export function formatDate(value: ISODateTime | ISODate): string {
  return format(parseISO(value), 'd MMM yyyy')
}

export function formatDateShort(value: ISODateTime | ISODate): string {
  return format(parseISO(value), 'd MMM')
}

export function formatDateTime(value: ISODateTime): string {
  return format(parseISO(value), 'd MMM yyyy, HH:mm')
}

/** "Today 08:12" / "Yesterday 21:40" / "14 Sep, 09:05" — for activity feeds. */
export function formatRelativeDay(value: ISODateTime): string {
  const date = parseISO(value)
  if (isToday(date)) return `Today ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `Yesterday ${format(date, 'HH:mm')}`
  return format(date, 'd MMM, HH:mm')
}

export function formatAgo(value: ISODateTime): string {
  return `${formatDistanceToNowStrict(parseISO(value))} ago`
}

export function formatQuantity(quantity: number, unit: string): string {
  const rounded = Math.round(quantity * 100) / 100
  return `${rounded} ${unit}`
}

export function formatMoney(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value)
}
