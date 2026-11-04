import { useStore } from '@/data/store'
import type { NotificationKind } from '@/data/types'
import { ToggleRow } from '@/components/ui/Field'

const OPTIONS: Array<{ kind: NotificationKind; title: string; description: string }> = [
  { kind: 'tasks', title: 'Checklist reminders', description: 'Remind me about due checklist tasks.' },
  { kind: 'temperatures', title: 'Temperature alerts', description: 'Notify me when a reading needs attention.' },
  { kind: 'signoff', title: 'Sign-off requests', description: 'Notify me when a record needs review.' },
]

/** What the bell tells this person about. Kept with them, so it follows them between devices. */
export function NotificationToggles() {
  const { activeStaff, saveStaff } = useStore()
  return (
    <div className="space-y-2.5">
      {OPTIONS.map(({ kind, title, description }) => (
        <ToggleRow
          key={kind}
          title={title}
          description={description}
          checked={activeStaff.notifications?.[kind] !== false}
          onChange={(on) => saveStaff({ ...activeStaff, notifications: { ...activeStaff.notifications, [kind]: on } })}
        />
      ))}
    </div>
  )
}
