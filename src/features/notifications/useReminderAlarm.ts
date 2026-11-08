import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Alert } from '@/data/attention'
import { useToast } from '@/components/ui/Toast'
import { devicePermission, showDeviceNotification } from './deviceNotifications'

/** Which reminders this device has already announced. Each device gets its own say. */
const ANNOUNCED_KEY = 'mise.reminders.announced'

/** Later than this, a reminder is news on opening the app, not something to pop up for. */
const ON_TIME_MS = 5 * 60_000

function readAnnounced(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(ANNOUNCED_KEY) ?? '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

function writeAnnounced(keys: string[]) {
  try {
    localStorage.setItem(ANNOUNCED_KEY, JSON.stringify(keys))
  } catch {
    // With storage blocked, the worst case is hearing about a reminder twice.
  }
}

/**
 * Announces each reminder once as it goes off: a device notification if that's
 * allowed and it's on time, otherwise a toast. The bell has it either way. Run
 * this in one place only, or a reminder would be announced by each.
 */
export function useReminderAlarm(alerts: Alert[]) {
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const reminders = alerts.filter((alert) => alert.kind === 'reminder')
    const announced = readAnnounced()
    const fresh = reminders.filter((alert) => !announced.includes(alert.key))
    if (fresh.length === 0) return
    // Only what's still showing is kept, so the list never grows for ever.
    writeAnnounced(reminders.map((alert) => alert.key))

    for (const alert of fresh) {
      const inApp = () => toast({ tone: 'info', title: alert.title, description: alert.detail })
      const onTime = Date.now() - Date.parse(alert.at) < ON_TIME_MS
      if (onTime && devicePermission() === 'granted') {
        void showDeviceNotification(alert.title, {
          body: alert.detail,
          tag: alert.key,
          to: '/notifications',
          onOpen: () => navigate('/notifications'),
        }).catch(inApp)
      } else {
        inApp()
      }
    }
  }, [alerts, toast, navigate])
}
