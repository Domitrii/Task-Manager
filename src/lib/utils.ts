import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Groups a list by a derived key, preserving insertion order of the keys. */
export function groupBy<T, K extends string>(list: T[], key: (item: T) => K): Record<K, T[]> {
  return list.reduce(
    (acc, item) => {
      const k = key(item)
      ;(acc[k] ??= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function sum(list: number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

/** Safe percentage — returns 0 rather than NaN when the denominator is 0. */
export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

export function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
