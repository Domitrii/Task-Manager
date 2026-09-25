import { createContext, use } from 'react'
import type { ID, MonitoredCategory } from '@/data/types'

export interface TemperatureEntryOptions {
  itemId?: ID
  /** Limits the picker to one section, e.g. only fridges on the fridge page. */
  restrictTo?: MonitoredCategory[]
}

/** Every way to add a record, reachable from any page without prop drilling. */
export interface QuickEntryApi {
  /** The "what are you logging?" sheet. */
  openLog: () => void
  recordTemperature: (options?: TemperatureEntryOptions) => void
  recordDelivery: () => void
  /** Starts today's run of a checklist, or shows the record if it is already signed off. */
  openChecklist: (templateId: ID) => void
  raiseIssue: () => void
  addTask: () => void
}

export const QuickEntryContext = createContext<QuickEntryApi | null>(null)

export function useQuickEntry(): QuickEntryApi {
  const context = use(QuickEntryContext)
  if (!context) throw new Error('useQuickEntry must be used inside <AppShell>')
  return context
}
