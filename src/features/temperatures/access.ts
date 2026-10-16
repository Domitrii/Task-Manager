import { useMemo } from 'react'
import { useStore } from '@/data/store'
import type { ID, TemperatureLog } from '@/data/types'
import { useSync } from '@/features/account/sync'

/**
 * How long whoever entered a reading has to put it right. After that only a
 * manager can change it. The server holds the same line (with a little slack
 * for a slow connection): see `supabase/migrations/20261015000000_reading_proof.sql`.
 */
export const EDIT_MINUTES = 20

export interface ReadingAccess {
  /** Sees every reading and photo, and can change any reading at any time. */
  manager: boolean
  /** Whoever is using the app. */
  staffId: ID
}

/**
 * With accounts, managers are the owner and whoever the owner chooses. On a
 * single device without accounts, anyone down as a Manager on the staff list.
 */
export function useIsManager(): boolean {
  const sync = useSync()
  const { activeStaff } = useStore()
  return sync ? sync.isManager : activeStaff.role === 'manager'
}

export function useReadingAccess(): ReadingAccess {
  const { activeStaff } = useStore()
  const manager = useIsManager()
  const staffId = activeStaff.id
  return useMemo(() => ({ manager, staffId }), [manager, staffId])
}

/** When whoever entered it can no longer change it. Null for readings from before there was a limit. */
export function editableUntil(log: TemperatureLog): Date | null {
  return log.enteredAt ? new Date(Date.parse(log.enteredAt) + EDIT_MINUTES * 60_000) : null
}

/** Entered by them, or (from before readings said who entered them) recorded as them. */
export function isOwnReading(log: TemperatureLog, access: ReadingAccess): boolean {
  return log.enteredBy ? log.enteredBy === access.staffId : log.recordedBy === access.staffId
}

export function canEditReading(log: TemperatureLog, access: ReadingAccess, now: Date): boolean {
  if (access.manager) return true
  const until = editableUntil(log)
  return log.enteredBy === access.staffId && until !== null && now < until
}

/** Other people's photos are for managers. Storage won't hand them to anyone else either. */
export function canSeePhoto(log: TemperatureLog, access: ReadingAccess): boolean {
  return access.manager || log.enteredBy === access.staffId
}
