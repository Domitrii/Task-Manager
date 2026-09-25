import { useMemo } from 'react'
import { format } from 'date-fns'
import { Flame, type LucideIcon, Package } from 'lucide-react'
import { selectDailyCompletion, selectDashboard, selectLogsForDay, selectToday } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatTemp, formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { useQuickEntry } from '@/components/layout/quickEntry'
import { DayStatus } from './DayStatus'
import { DayTimeline } from './DayTimeline'
import { AtAGlance, WeekStrip, type GlanceRow } from './TodayStats'

/**
 * Home. Answers "what do I need to do now?" first, then "how are we doing?" —
 * the two questions people open the app with.
 */
export function TodayPage() {
  const now = useNow()
  const { data, activeStaff } = useStore()
  const quickEntry = useQuickEntry()

  const today = useMemo(() => selectToday(data, now), [data, now])
  const week = useMemo(() => selectDailyCompletion(data, 7, now), [data, now])
  const summary = useMemo(() => selectDashboard(data, now), [data, now])

  const hour = now.getHours()
  const greeting = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${activeStaff.name.split(' ')[0]}`

  const probesToday = useMemo(() => {
    const probed = new Set(
      data.items.filter((item) => item.category === 'cooking' || item.category === 'cooling').map((item) => item.id),
    )
    return selectLogsForDay(data, now).filter((log) => probed.has(log.itemId))
  }, [data, now])
  const lastProbe = probesToday[0]
  const lastDelivery = summary.deliveriesToday[0]

  const glance: GlanceRow[] = [
    {
      label: 'Out of range today',
      value: summary.failedLogsToday.length,
      to: '/temperatures',
      attention: 'fail',
    },
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
      label: 'Overdue tasks',
      detail: `${summary.outstandingTasks.length} open in total`,
      value: summary.overdueTasks.length,
      to: '/tasks',
      attention: 'warn',
    },
    { label: 'Low on stock', value: summary.lowStock.length, to: '/stock', attention: 'warn' },
  ]

  return (
    <div className="grid gap-x-10 gap-y-10 pt-2 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-10">
        <DayStatus
          today={today}
          greeting={greeting}
          dateLabel={format(now, 'EEEE d MMMM')}
          failedReadings={summary.failedLogsToday.length}
        />

        <DayTimeline periods={today.periods} />

        <section aria-labelledby="anytime" className="pl-10 sm:pl-11">
          <h2 id="anytime" className="text-ink text-xl font-bold">
            Anytime
          </h2>
          <p className="text-ink-muted mt-0.5 text-[15px]">Log these whenever they happen.</p>
          <div className="bg-surface border-line divide-line mt-3 divide-y overflow-hidden rounded-xl border">
            <AnytimeRow
              icon={Flame}
              title="Food probe"
              detail={
                lastProbe
                  ? `${probesToday.length} today. Last: ${data.items.find((item) => item.id === lastProbe.itemId)?.name}, ${formatTemp(lastProbe.temperature)} at ${formatTime(lastProbe.recordedAt)}`
                  : 'None logged yet today'
              }
              onClick={() => quickEntry.recordTemperature({ restrictTo: ['cooking', 'cooling'] })}
            />
            <AnytimeRow
              icon={Package}
              title="Delivery"
              detail={
                lastDelivery
                  ? `${summary.deliveriesToday.length} today. Last: ${data.suppliers.find((supplier) => supplier.id === lastDelivery.supplierId)?.name} at ${formatTime(lastDelivery.receivedAt)}`
                  : 'None received yet today'
              }
              onClick={quickEntry.recordDelivery}
            />
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-10 xl:pt-9" aria-label="Stats">
        <WeekStrip days={week} />
        <AtAGlance rows={glance} />
      </aside>
    </div>
  )
}

function AnytimeRow({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-surface-muted/60 flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <span className="bg-surface-muted text-ink-muted flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink block text-base font-semibold">{title}</span>
        <span className="text-ink-muted line-clamp-2 text-sm">{detail}</span>
      </span>
      <span className="bg-brand-600 flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-white">
        Log
      </span>
    </button>
  )
}
