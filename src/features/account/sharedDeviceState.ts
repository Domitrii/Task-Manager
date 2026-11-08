/**
 * What a shared kitchen device keeps besides its screens (see `SharedDevice.tsx`):
 * how soon it locks, whether it's locked, and tidying away PINs kept as typed.
 */
import { createContext, use, useEffect, useRef } from 'react'
import { useStore } from '@/data/store'
import { hashPin, PIN_PATTERN } from '@/lib/pin'
import { useIsManager } from '@/features/temperatures/access'

const LOCK_AFTER_KEY = 'mise.sharedDevice.lockAfter'
export const LOCK_AFTER_CHOICES = [2, 5, 10, 30]
const DEFAULT_LOCK_AFTER = 5

export function readLockAfter(): number {
  try {
    const stored = Number(localStorage.getItem(LOCK_AFTER_KEY))
    return LOCK_AFTER_CHOICES.includes(stored) ? stored : DEFAULT_LOCK_AFTER
  } catch {
    return DEFAULT_LOCK_AFTER
  }
}

export function writeLockAfter(minutes: number) {
  try {
    localStorage.setItem(LOCK_AFTER_KEY, String(minutes))
  } catch {
    // Storage blocked: the default stays.
  }
}

export interface SharedLock {
  /** Whether this is a shared kitchen device right now: signed in, and switched on. */
  active: boolean
  locked: boolean
  lock: () => void
}

export const SharedLockContext = createContext<SharedLock>({ active: false, locked: false, lock: () => {} })

export function useSharedLock(): SharedLock {
  return use(SharedLockContext)
}

/**
 * PINs used to be kept as typed, where every device in the team could read
 * them. A manager's device hashes any it finds and drops the typed one, so
 * people's PINs keep working without being readable.
 */
export function useLegacyPins() {
  const { data, saveStaff } = useStore()
  const manager = useIsManager()
  const working = useRef(new Set<string>())

  useEffect(() => {
    if (!manager) return
    for (const person of data.staff) {
      if (!person.pin || working.current.has(person.id)) continue
      working.current.add(person.id)
      const typed = person.pin
      void (person.pinHash || !PIN_PATTERN.test(typed) ? Promise.resolve(person.pinHash) : hashPin(typed)).then((pinHash) =>
        saveStaff({ ...person, pinHash }),
      )
    }
  }, [manager, data.staff, saveStaff])
}
