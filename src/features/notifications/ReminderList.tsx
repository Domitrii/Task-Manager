import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { DEFAULT_REMINDER_TITLE, isExpired, isFinished, reminderSchedule } from '@/data/reminders'
import { useStore } from '@/data/store'
import type { Reminder } from '@/data/types'
import { supabase } from '@/lib/supabase'
import { useNow } from '@/lib/useNow'
import { useSync } from '@/features/account/sync'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Field'
import { InfoCard } from '@/components/shared/ListCard'
import { askForDeviceNotifications, devicePermission, type DevicePermission } from './deviceNotifications'
import { needsHomeScreen, registerForPush } from './push'
import { ReminderModal } from './ReminderModal'

const PERMISSION_TEXT: Record<DevicePermission, string> = {
  granted: 'Notifications are on.',
  default: 'Turn on notifications to get a pop-up at the time you choose.',
  denied: 'Notifications are blocked for Mise. You can allow them in your browser’s site settings.',
  unsupported: 'This browser can’t show notifications, so your reminders appear in the bell.',
}

/** The times someone has asked to be reminded, and whether this device can pop up for them. */
export function ReminderList() {
  const now = useNow()
  const { activeStaff, saveStaff, sharedDevice } = useStore()
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null)
  const [permission, setPermission] = useState(devicePermission)
  // Whether reminders reach this device with Mise closed, once that's known.
  const [closedToo, setClosedToo] = useState(false)
  const sync = useSync()
  const teamId = sync?.team.id
  const userId = sync?.userId

  useEffect(() => {
    if (permission !== 'granted' || !supabase || !teamId || !userId || sharedDevice) return
    let live = true
    registerForPush(supabase, teamId, userId).then(
      (on) => live && setClosedToo(on),
      () => live && setClosedToo(false),
    )
    return () => {
      live = false
    }
  }, [permission, teamId, userId, sharedDevice])

  const reminders = activeStaff.reminders ?? []
  const shown = reminders.filter((reminder) => !isFinished(reminder, now)).sort((a, b) => a.time.localeCompare(b.time))

  function store(next: Reminder[]) {
    const today = new Date()
    saveStaff({ ...activeStaff, reminders: next.filter((reminder) => !isExpired(reminder, today)) })
  }

  const ask = () => void askForDeviceNotifications().then(setPermission)

  function save(reminder: Reminder) {
    store([...reminders.filter((entry) => entry.id !== reminder.id), reminder])
    setEditing(null)
    ask()
  }

  function setOn(reminder: Reminder, on: boolean) {
    store(reminders.map((entry) => (entry.id === reminder.id ? { ...entry, on, setAt: new Date().toISOString() } : entry)))
  }

  function remove(reminder: Reminder) {
    store(reminders.filter((entry) => entry.id !== reminder.id))
    setEditing(null)
  }

  const open = editing && editing !== 'new' ? editing : undefined

  return (
    <div className="space-y-3.5">
      <section aria-labelledby="your-reminders" className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="your-reminders" className="font-display text-ink text-lg font-bold">
            Your reminders
          </h2>
          <Button size="sm" variant="subtle" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            Add reminder
          </Button>
        </div>
        {shown.length === 0 ? (
          <p className="text-ink-muted text-[13px]">
            Choose a time to be reminded to check everything. You’ll see what’s waiting when it goes off.
          </p>
        ) : (
          shown.map((reminder) => (
            <div key={reminder.id} className="bg-surface flex items-center gap-3 rounded-xl px-3.5 py-3">
              <button
                type="button"
                onClick={() => setEditing(reminder)}
                aria-label={`Change reminder at ${reminder.time}`}
                className="min-w-0 flex-1 text-left"
              >
                <span className="text-ink block text-sm font-semibold tabular-nums">{reminder.time}</span>
                <span className="text-ink-muted block text-xs">{reminderSchedule(reminder)}</span>
                <span className="text-ink-muted block truncate text-xs">{reminder.note || DEFAULT_REMINDER_TITLE}</span>
              </button>
              <Toggle
                checked={reminder.on}
                onChange={(on) => setOn(reminder, on)}
                label={`Reminder at ${reminder.time}`}
              />
            </div>
          ))
        )}
      </section>

      <InfoCard
        title="Pop-ups on this device"
        action={
          permission === 'default' ? (
            <Button size="sm" onClick={ask}>
              Turn on
            </Button>
          ) : undefined
        }
      >
        <p className="text-ink">{PERMISSION_TEXT[permission]}</p>
        <p>
          {closedToo
            ? 'Reminders reach this device even when Mise is closed.'
            : needsHomeScreen()
              ? 'On an iPhone or iPad, add Mise to your Home Screen (Share, then Add to Home Screen) and open it from there to get reminders when it’s closed.'
              : 'Mise has to be open for a reminder to pop up. If it’s closed, the reminder waits in the bell until you’re back.'}
        </p>
      </InfoCard>

      {editing ? (
        <ReminderModal
          reminder={open}
          onSave={save}
          onDelete={() => open && remove(open)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
