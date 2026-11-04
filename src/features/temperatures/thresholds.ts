/** How an appliance's limits read, and which monitored items count as appliances. */
import type { CheckOutcome, MonitoredItem } from '@/data/types'

/** Probes are logged per batch, on the Food probe page, so they aren't appliances. */
export function isApplianceItem(item: Pick<MonitoredItem, 'category'>): boolean {
  return item.category !== 'cooking' && item.category !== 'cooling'
}

/** "Target 0–5°C" */
export function targetText({ minTemp: min, maxTemp: max }: Pick<MonitoredItem, 'minTemp' | 'maxTemp'>): string {
  if (min !== null && max !== null) return `Target ${min}–${max}°C`
  if (max !== null) return `Target ${max}°C or below`
  if (min !== null) return `Target ${min}°C or above`
  return 'No target set'
}

/** "Above 8°C": where a reading stops being acceptable. */
export function failText(item: Pick<MonitoredItem, 'minTemp' | 'maxTemp' | 'failAbove'>): string {
  const ceiling = item.failAbove ?? item.maxTemp
  if (ceiling !== null) return `Above ${ceiling}°C`
  return item.minTemp !== null ? `Below ${item.minTemp}°C` : 'No limit set'
}

export function outcomeTone(outcome: CheckOutcome | undefined): 'pass' | 'fail' | 'neutral' {
  return outcome === 'fail' ? 'fail' : outcome === 'pass' ? 'pass' : 'neutral'
}
