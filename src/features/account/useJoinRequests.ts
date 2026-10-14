import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchJoinRequests, type JoinRequest, type TeamRef } from './team'

/** How often an open app looks for people asking to join. */
const CHECK_EVERY = 60_000

/**
 * People waiting to join the team, for the owner and anyone they allow (the
 * server sends nobody else any). Looked up while the app is open: every
 * minute, whenever it comes back into view, and when the connection returns.
 */
export function useJoinRequests(client: SupabaseClient, team: TeamRef) {
  const [requests, setRequests] = useState<JoinRequest[]>([])

  const refresh = useCallback(() => {
    fetchJoinRequests(client, team).then(
      // The same list again shouldn't redraw everything that shows it.
      (next) => setRequests((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next)),
      () => {
        // Offline: keep what's showing until the next check.
      },
    )
  }, [client, team])

  /** Takes someone off the list once they've been answered, without waiting for the next check. */
  const drop = useCallback((userId: string) => {
    setRequests((current) => current.filter((request) => request.userId !== userId))
  }, [])

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

  return { requests, refresh, drop }
}
