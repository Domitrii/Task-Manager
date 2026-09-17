import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Thermometer } from 'lucide-react'
import {
  selectItemsForCategories,
  selectLatestReadings,
  selectLogsForCategories,
  selectLogsForDay,
} from '@/data/selectors'
import { useStore } from '@/data/store'
import type { MonitoredCategory, MonitoredItem } from '@/data/types'
import { buildCheckSlots, summariseSlots } from '@/lib/compliance'
import { formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { useQuickEntry } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { CheckMatrix } from './CheckMatrix'
import { EquipmentStatusGrid } from './EquipmentStatusGrid'
import { TemperatureHistoryTable } from './TemperatureHistoryTable'

type TabKey = 'today' | 'equipment' | 'history'

const ALL_CATEGORIES: MonitoredCategory[] = [
  'fridge',
  'freezer',
  'display_fridge',
  'hot_holding',
  'cooking',
  'cooling',
]

/**
 * Shared shell for every temperature page. The fridge, freezer, hot-holding and
 * cooking routes are the same workflow over a different slice of equipment, so
 * they share one component rather than four near-copies.
 */
export function TemperatureSection({
  title,
  description,
  categories,
  todayLabel = "Today's checks",
}: {
  title: string
  description: string
  categories?: MonitoredCategory[]
  todayLabel?: string
}) {
  const now = useNow()
  const { data } = useStore()
  const quickEntry = useQuickEntry()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>('today')

  const scope = categories ?? ALL_CATEGORIES
  const items = useMemo(() => selectItemsForCategories(data, scope), [data, scope])
  const logs = useMemo(() => selectLogsForCategories(data, scope), [data, scope])
  const readings = useMemo(() => selectLatestReadings(data, items), [data, items])

  const slots = useMemo(
    () => buildCheckSlots(items, data.temperatureLogs, data.settings, now),
    [items, data.temperatureLogs, data.settings, now],
  )
  const summary = useMemo(() => summariseSlots(slots), [slots])

  const todayLogs = useMemo(
    () => selectLogsForDay({ ...data, temperatureLogs: logs }, now),
    [data, logs, now],
  )
  const failedToday = todayLogs.filter((log) => log.outcome === 'fail')
  const lastLog = logs[0]

  // A deep link from the command palette pre-selects the equipment to record.
  const focusedItemId = searchParams.get('item') ?? undefined

  function openRecord(item?: MonitoredItem) {
    quickEntry.recordTemperature({ itemId: item?.id, restrictTo: categories })
    if (focusedItemId) {
      searchParams.delete('item')
      setSearchParams(searchParams, { replace: true })
    }
  }

  const scheduled = slots.length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="primary" onClick={() => openRecord()} className="gap-1.5">
            <Thermometer className="size-4" />
            Record temperature
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {scheduled ? (
          <>
            <StatCard
              label="Scheduled checks today"
              value={`${summary.completed}/${summary.required}`}
              sublabel={`${summary.completionRate}% of today's schedule`}
              icon={<CheckCircle2 className="size-4" />}
              tone={summary.completed === summary.required ? 'pass' : 'neutral'}
            />
            <StatCard
              label="Overdue"
              value={summary.overdue}
              sublabel={summary.due > 0 ? `${summary.due} due now` : 'Nothing else due right now'}
              icon={<Clock className="size-4" />}
              tone={summary.overdue > 0 ? 'fail' : 'neutral'}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Probes recorded today"
              value={todayLogs.length}
              sublabel="Recorded per batch, not on a timetable"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StatCard
              label="Items monitored"
              value={items.length}
              sublabel="Dishes and processes with a target temperature"
              icon={<Thermometer className="size-4" />}
            />
          </>
        )}
        <StatCard
          label="Failed readings today"
          value={failedToday.length}
          sublabel={failedToday.length > 0 ? 'Corrective action required' : 'All readings in range'}
          icon={<AlertTriangle className="size-4" />}
          tone={failedToday.length > 0 ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Last reading"
          value={lastLog ? formatTime(lastLog.recordedAt) : '—'}
          sublabel={
            lastLog
              ? data.items.find((item) => item.id === lastLog.itemId)?.name
              : 'Nothing recorded yet'
          }
          icon={<Clock className="size-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'today', label: todayLabel },
              { value: 'equipment', label: 'Current status', count: items.length },
              { value: 'history', label: 'History', count: logs.length },
            ]}
          />
        </div>

        {tab === 'today' ? (
          scheduled ? (
            <CheckMatrix slots={slots} onRecord={openRecord} />
          ) : (
            <TemperatureHistoryTable logs={todayLogs} items={items} />
          )
        ) : null}

        {tab === 'equipment' ? (
          <div className="p-4 sm:p-5">
            <EquipmentStatusGrid readings={readings} onRecord={openRecord} />
          </div>
        ) : null}

        {tab === 'history' ? <TemperatureHistoryTable logs={logs} items={items} /> : null}
      </Card>
    </div>
  )
}
