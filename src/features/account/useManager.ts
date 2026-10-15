import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMyAccess, type TeamRef } from './team'

/** How often an open app checks whether the owner has changed who's a manager. */
const CHECK_EVERY = 60_000

/**
 * Whether this account is a manager in its team. Remembered on the device, so
 * a manager opening the app with no signal still gets the manager's screens;
 * checked again every minute, on coming back to the app and on reconnecting.
 */
export function useManager(client: SupabaseClient, team: TeamRef, userId: string): boolean {
  const key = `mise.manager.${team.id}.${userId}`
  const [manager, setManager] = useState(() => read(key))

  const refresh = useCallback(() => {
    fetchMyAccess(client, team, userId).then(
      (access) => {
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
  }, [client, team, userId, key])

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

  return manager
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}
