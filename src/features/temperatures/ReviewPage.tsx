import { useState } from 'react'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Lock, Pencil, Thermometer } from 'lucide-react'
import { useStore } from '@/data/store'
import type { TemperatureLog } from '@/data/types'
import { buildCheckSlots, startOfDayLocal, type CheckSlot } from '@/lib/compliance'
import { useNow } from '@/lib/useNow'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { useSync } from '@/features/account/sync'
import { useReadingAccess } from './access'
import { TemperatureHistoryTable } from './TemperatureHistoryTable'

type Span = 'day' | 'week'

/**
 * Every reading for a day or a week in one place, with its photo, who took
 * it, when it was really entered and whether it's been changed, plus the
 * scheduled checks nobody did. For managers, who can change any reading here.
 */
export function TemperatureReviewPage() {
  const now = useNow()
  const { data } = useStore()
  const sync = useSync()
  const access = useReadingAccess()
  const [span, setSpan] = useState<Span>('day')
  const [anchor, setAnchor] = useState(() => startOfDayLocal(new Date()))

  const startTime = (span === 'day' ? anchor : startOfWeek(anchor, { weekStartsOn: 1 })).getTime()
  const endTime = addDays(startTime, span === 'day' ? 1 : 7).getTime()
  const start = new Date(startTime)
  const end = new Date(endTime)
  const today = startOfDayLocal(now)
  const current = start <= today && today < end

  const logs = readingsBetween(data.temperatureLogs, startTime, endTime)

  // Scheduled checks whose window closed with nothing logged, day by day up to now.
  // A closing window can run past midnight, so the day after's readings come too.
  const nearby = readingsBetween(data.temperatureLogs, startTime, addDays(endTime, 1).getTime())
  const missed: { day: Date; slot: CheckSlot }[] = []
  for (let day = start; day < end && day <= now; day = addDays(day, 1)) {
    const at = isSameDay(day, now) ? now : new Date(day.getTime() + 86_399_999)
    for (const slot of buildCheckSlots(data.items, nearby, data.settings, at)) {
      if (slot.state === 'overdue') missed.push({ day, slot })
    }
  }

  const items = data.items.filter((item) => item.active || logs.some((log) => log.itemId === item.id))

  if (!access.manager) {
    return (
      <div className="space-y-5">
        <PageHeader title="Temperature review" />
        <Card>
          <EmptyState
            icon={<Lock className="size-5" />}
            title="For managers"
            description={
              sync
                ? 'Only the owner and managers can look back over the team’s readings. The owner can make you a manager in Settings → Team.'
                : 'Only someone down as a Manager on the staff list can look back over the readings.'
            }
            action={<ButtonLink to="/temperatures">Back to temperatures</ButtonLink>}
          />
        </Card>
      </div>
    )
  }

  const failed = logs.filter((log) => log.outcome === 'fail').length
  const changed = logs.filter((log) => (log.edits?.length ?? 0) > 0).length
  const label =
    span === 'day'
      ? format(start, 'EEEE d MMMM yyyy')
      : `${format(start, 'd MMM')} – ${format(addDays(end, -1), 'd MMM yyyy')}`

  function move(direction: -1 | 1) {
    setAnchor((day) => addDays(day, direction * (span === 'day' ? 1 : 7)))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Temperature review"
        description="Every reading for a day or a week, with its photo. You can change any of them; each change is kept with the reading, with who made it and why."
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={span}
          onChange={setSpan}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
          ]}
        />
        <div className="flex items-center gap-1">
          <IconButton label={span === 'day' ? 'Day before' : 'Week before'} size="sm" onClick={() => move(-1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <p className="text-ink min-w-0 px-1 text-sm font-semibold">{label}</p>
          <IconButton
            label={span === 'day' ? 'Day after' : 'Week after'}
            size="sm"
            disabled={end > today}
            onClick={() => move(1)}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
        {current ? null : (
          <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>
            {span === 'day' ? 'Today' : 'This week'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Readings" value={logs.length} icon={<Thermometer className="size-4" />} />
        <StatCard
          label="Out of range"
          value={failed}
          icon={<AlertTriangle className="size-4" />}
          tone={failed > 0 ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Missed checks"
          value={missed.length}
          sublabel={missed.length > 0 ? 'Listed below' : undefined}
          icon={<Clock className="size-4" />}
          tone={missed.length > 0 ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Changed after saving"
          value={changed}
          sublabel={changed > 0 ? 'Marked “Changed” below' : undefined}
          icon={<Pencil className="size-4" />}
          tone={changed > 0 ? 'info' : 'neutral'}
        />
      </div>

      {missed.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader title="Missed checks" description="Scheduled checks whose time ran out with nothing logged" />
          <ul className="divide-line divide-y">
            {missed.map(({ day, slot }) => (
              <li
                key={`${day.toISOString()}-${slot.item.id}-${slot.period}`}
                className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5 sm:px-5"
              >
                <span className="text-ink-muted w-24 shrink-0 text-[13px]">
                  {span === 'week' ? format(day, 'EEE d MMM') : format(day, 'd MMM')}
                </span>
                <span className="text-ink text-sm font-medium">{slot.item.name}</span>
                <span className="text-ink-muted text-[13px]">
                  {slot.window.label} check, {slot.window.startTime}–{slot.window.endTime}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="Readings" description={label} />
        <TemperatureHistoryTable key={`${span}-${start.getTime()}`} logs={logs} items={items} />
      </Card>
    </div>
  )
}

function readingsBetween(logs: TemperatureLog[], from: number, to: number): TemperatureLog[] {
  return logs.filter((log) => {
    const at = Date.parse(log.recordedAt)
    return at >= from && at < to
  })
}
