/**
 * Standard UK safe ranges.
 *
 * Shared by the demo data and the setup packs so both start from the same
 * numbers. They are starting values only: every item copies them into its own
 * `minTemp`/`maxTemp`, and the venue can change them in Settings.
 */
import type { MonitoredCategory, MonitoredItem } from './types'

export const SAFE_RANGES: Record<MonitoredCategory, Pick<MonitoredItem, 'minTemp' | 'maxTemp'>> = {
  // The legal limit is 8°C; 5°C is the FSA's recommended working maximum.
  fridge: { minTemp: 0, maxTemp: 5 },
  freezer: { minTemp: -24, maxTemp: -18 },
  display_fridge: { minTemp: 0, maxTemp: 8 },
  hot_holding: { minTemp: 63, maxTemp: null },
  cooking: { minTemp: 75, maxTemp: null },
  cooling: { minTemp: null, maxTemp: 8 },
}

/** Goods arriving above these are flagged for rejection. */
export const DELIVERY_LIMITS = { chilled: 8, frozen: -15 }
