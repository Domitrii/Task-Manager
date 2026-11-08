import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { selectHome, type AlertGroup, type EntryAction } from '@/data/attention'
import { selectDailyCompletion, selectDashboard, selectOrdersToCheckIn } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ID } from '@/data/types'
import { useNow } from '@/lib/useNow'
import { useQuickEntry } from '@/components/layout/quickEntry'
import { Badge } from '@/components/ui/Badge'
import { useAlerts } from '@/features/notifications/useAlerts'
import { TaskRunModal } from '@/features/tasks/TaskRunModal'
import { HomeCardView } from './HomeCard'
import { AtAGlance, WeekStrip, type GlanceRow } from './TodayStats'

const PROBE_CATEGORIES = ['cooking', 'cooling'] as const

/** The bell's sections that need someone now; "Coming soon" and reminders don't yet. */
const NEEDS_ACTION = new Set<AlertGroup>(['missed', 'overdue', 'attention'])

/** Home. Says how the venue stands, and opens onto the three things people check on it. */
export function TodayPage() {
  const now = useNow()
  const { data } = useStore()
  const quickEntry = useQuickEntry()
  // By id, so the sheet always shows the task as it is in the store.
  const [runningId, setRunningId] = useState<ID | null>(null)
  const running = data.tasks.find((task) => task.id === runningId)

  const home = useMemo(() => selectHome(data, now), [data, now])
  const { alerts } = useAlerts()
  const attention = alerts.filter((alert) => NEEDS_ACTION.has(alert.group)).length
  const week = useMemo(() => selectDailyCompletion(data, 7, now), [data, now])
  const summary = useMemo(() => selectDashboard(data, now), [data, now])
  const orders = useMemo(() => selectOrdersToCheckIn(data, now), [data, now])
  const toCheckIn = orders.due.length + orders.overdue.length

  function open(action: EntryAction) {
    if (action.kind === 'task') setRunningId(action.id)
    else if (action.kind === 'checklist') quickEntry.openChecklist(action.id)
    else if (action.kind === 'temperature') quickEntry.recordTemperature({ itemId: action.itemId })
    else quickEntry.recordTemperature({ restrictTo: [...PROBE_CATEGORIES] })
  }

  const glance: GlanceRow[] = [
    { label: 'Out of range today', value: summary.failedLogsToday.length, to: '/temperatures', attention: 'fail' },
    {
      label: 'Open issues',
      detail: summary.highSeverityIssues.length > 0 ? `${summary.highSeverityIssues.length} high severity` : undefined,
      value: summary.openIssues.length,
      to: '/food-safety',
      attention: 'fail',
    },
    {
      label: 'Deliveries today',
      detail:
        summary.rejectedRecently.length > 0
          ? `${summary.rejectedRecently.length} with rejections this week`
          : undefined,
      value: summary.deliveriesToday.length,
      to: '/deliveries',
    },
    {
      label: 'Orders to check in',
      detail: orders.overdue.length > 0 ? `${orders.overdue.length} overdue` : orders.due.length > 0 ? 'Arriving today' : undefined,
      value: toCheckIn,
      to: '/deliveries',
      attention: orders.overdue.length > 0 ? 'fail' : 'warn',
    },
    { label: 'Low on stock', value: summary.lowStock.length, to: '/stock', attention: 'warn' },
  ]

  return (
    <div className="grid gap-x-10 gap-y-10 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0">
        <h1 className="font-display text-ink text-[28px] leading-tight font-bold">{data.settings.venueName}</h1>
        <p className="text-ink-muted mt-3 text-sm">
          {format(now, 'EEE d MMM, HH:mm')}
          {home.period ? ` · ${home.period} shift` : ''}
        </p>
        <div className="mt-2">
          {/* The same as the bell's Missed, Overdue and Needs attention, and opens them. */}
          {attention > 0 ? (
            <Link to="/notifications" aria-label={`${attention} ${attention === 1 ? 'needs' : 'need'} attention. Show them`}>
              <Badge tone="fail">! {attention} {attention === 1 ? 'needs' : 'need'} attention</Badge>
            </Link>
          ) : (
            <Badge tone="pass">✓ All clear</Badge>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {home.cards.map((card) => (
            <HomeCardView
              key={card.key}
              card={card}
              onOpen={open}
              onLogProbe={
                card.key === 'probe'
                  ? () => quickEntry.recordTemperature({ restrictTo: [...PROBE_CATEGORIES] })
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* Room to spare on a desktop, so the numbers behind the bell stay in view. */}
      <aside className="hidden min-w-0 space-y-10 xl:block" aria-label="Stats">
        <WeekStrip days={week} />
        <AtAGlance rows={glance} />
      </aside>

      {running ? <TaskRunModal key={running.id} task={running} onClose={() => setRunningId(null)} /> : null}
    </div>
  )
}
