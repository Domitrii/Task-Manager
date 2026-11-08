import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMyAccess, fetchTeamPeople, type TeamRef } from './team'

/** How often an open app checks whether the owner has changed who's a manager. */
const CHECK_EVERY = 60_000

/**
 * Whether this account is a manager in its team, and whether it's still in it
 * at all. Remembered on the device, so a manager opening the app with no signal
 * still gets the manager's screens; checked again every minute, on coming back
 * to the app and on reconnecting.
 */
export function useManager(
  client: SupabaseClient,
  team: TeamRef,
  userId: string,
): { isManager: boolean; removed: boolean; managerIds: string[] } {
  const key = `mise.manager.${team.id}.${userId}`
  const managersKey = `mise.managers.${team.id}`
  const [manager, setManager] = useState(() => read(key))
  const [removed, setRemoved] = useState(false)
  const [managerIds, setManagerIds] = useState<string[]>(() => readList(managersKey))

  const refresh = useCallback(() => {
    fetchMyAccess(client, team, userId).then(
      (access) => {
        if (!access) {
          setRemoved(true)
          return
        }
        setManager(access.isManager)
        try {
          localStorage.setItem(key, String(access.isManager))
        } catch {
          // Storage unavailable: it's checked again next time.
        }
      },
      () => {
        // Offline: keep what's known until the next check.
      },
    )
    // Only a shared kitchen device needs to know who else is a manager.
    if (read('mise.sharedDevice')) {
      fetchTeamPeople(client, team).then(
        (people) => {
          const ids = people.filter((person) => person.role === 'owner' || person.isManager).map((person) => person.userId)
          setManagerIds(ids)
          try {
            localStorage.setItem(managersKey, JSON.stringify(ids))
          } catch {
            // Storage unavailable: it's checked again next time.
          }
        },
        () => {
          // Offline: keep what's known.
        },
      )
    }
  }, [client, team, userId, key, managersKey])

  useEffect(() => {
    refresh()
    const whenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(whenVisible, CHECK_EVERY)
    document.addEventListener('visibilitychange', whenVisible)
    window.addEventListener('online', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', whenVisible)
      window.removeEventListener('online', refresh)
    }
  }, [refresh])

  return { isManager: manager, removed, managerIds }
}

function readList(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored) ? stored.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}
