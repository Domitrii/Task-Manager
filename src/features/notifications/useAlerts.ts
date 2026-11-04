import { useCallback, useMemo } from 'react'
import { selectAlerts, type Alert } from '@/data/attention'
import { useStore } from '@/data/store'
import { useSync } from '@/features/account/sync'
import type { JoinRequest } from '@/features/account/team'
import { useNow } from '@/lib/useNow'

/** People waiting to be let into the team, for whoever can let them in. */
function joinAlerts(requests: JoinRequest[], now: Date): Alert[] {
  return requests.map((request) => ({
    key: `join-${request.userId}`,
    kind: 'always',
    group: 'attention',
    tone: 'warn',
    status: 'Asking to join',
    title: request.name || request.email,
    detail: 'Waiting for approval',
    to: '/settings/manage?tab=staff',
    rank: 0,
    at: request.requestedAt ?? now.toISOString(),
  }))
}

/** This person's notifications, and which of them they've read. */
export function useAlerts() {
  const now = useNow()
  const { data, activeStaff, saveStaff } = useStore()
  const joinRequests = useSync()?.joinRequests

  const alerts = useMemo(
    () => [...selectAlerts(data, now, activeStaff.notifications), ...joinAlerts(joinRequests ?? [], now)],
    [data, now, activeStaff.notifications, joinRequests],
  )

  const read = useMemo(() => new Set(activeStaff.readAlerts), [activeStaff.readAlerts])
  const unread = useMemo(() => alerts.filter((alert) => !read.has(alert.key)), [alerts, read])

  const remember = useCallback(
    (keys: string[]) => {
      if (activeStaff.id) saveStaff({ ...activeStaff, readAlerts: keys })
    },
    [activeStaff, saveStaff],
  )

  return {
    alerts,
    unread,
    isRead: (alert: Alert) => read.has(alert.key),
    // Only what's still showing is kept, so the list never grows for ever.
    markRead: (alert: Alert) =>
      remember([...alerts.filter((entry) => read.has(entry.key)).map((entry) => entry.key), alert.key]),
    markAllRead: () => remember(alerts.map((alert) => alert.key)),
  }
}
