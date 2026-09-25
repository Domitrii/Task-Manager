/**
 * Setup packs.
 *
 * A pack is a starting point for one kind of venue: the equipment it usually
 * runs, the checklists it works through and when in the day checks happen.
 * Packs are only ever read by `buildDataFromSetupPack`, which copies them into
 * ordinary records with fresh ids. Nothing in a venue's data points back at a
 * pack, so editing a pack here never changes a venue that was already set up.
 */
import type { CheckPeriod, CheckPeriodWindow, ChecklistType, MonitoredCategory } from '../types'

export type SetupPackId = 'restaurant' | 'cafe' | 'pub' | 'takeaway' | 'bakery'

/** Equipment the venue counts during setup. Units are numbered 1…n. */
export type UnitCategory = 'fridge' | 'freezer' | 'hot_holding'

/** A setup answer that switches a checklist item on. */
export type PackCondition = 'cooksFromRaw' | 'hotHolding'

export interface PackUnit {
  /** Numbered on creation: "Fridge" becomes "Fridge 1", "Fridge 2"… */
  name: string
  location: string
  minTemp: number | null
  maxTemp: number | null
  requiredChecks: CheckPeriod[]
  /** Suggested count before the venue answers. */
  defaultCount: number
  notes?: string
}

export interface PackItem {
  /** Unique within the pack, so the preview can untick it. */
  key: string
  name: string
  category: MonitoredCategory
  location: string
  minTemp: number | null
  maxTemp: number | null
  requiredChecks: CheckPeriod[]
  notes?: string
}

export interface PackChecklistItem {
  label: string
  hint?: string
  /** A failed critical item raises a food-safety issue automatically. */
  critical: boolean
  /** Only included when the venue's answers match. */
  when?: PackCondition
}

export interface PackChecklist {
  /** Unique within the pack, so the preview can untick it. */
  key: string
  name: string
  type: ChecklistType
  period: CheckPeriod
  area?: string
  items: PackChecklistItem[]
}

export interface SetupPack {
  id: SetupPackId
  name: string
  /** One line for the picker. */
  description: string
  /** Typical trading hours. The opening and closing windows below are set for these. */
  hours: { open: string; close: string }
  /** All four check windows. A venue with different hours gets them moved to fit. */
  periods: CheckPeriodWindow[]
  units: Record<UnitCategory, PackUnit>
  /** Fixed extras that aren't counted during setup, like a display fridge. */
  extras: PackItem[]
  /** Cooking and cooling probes, added only when the venue cooks from raw. */
  probes: PackItem[]
  cooksFromRawByDefault: boolean
  checklists: PackChecklist[]
}
