import { useCallback, useMemo } from 'react'
import { reminderAlerts, selectAlerts, type Alert } from '@/data/attention'
import { useStore } from '@/data/store'
import { useSync } from '@/features/account/sync'
import type { JoinRequest } from '@/features/account/team'
import { useNow } from '@/lib/useNow'
import { useIsManager } from '@/features/temperatures/access'

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
  const manager = useIsManager()
  const staffId = activeStaff.id

  const alerts = useMemo(() => {
    const viewer = { staffId, manager }
    const others = [...selectAlerts(data, now, activeStaff.notifications, viewer), ...joinAlerts(joinRequests ?? [], now)]
    return [...reminderAlerts(activeStaff.reminders, others, now), ...others]
  }, [data, now, activeStaff.notifications, activeStaff.reminders, joinRequests, staffId, manager])

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
