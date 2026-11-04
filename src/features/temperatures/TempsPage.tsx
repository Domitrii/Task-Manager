import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Check, ChevronRight, CircleAlert, ClipboardList, Thermometer } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { TemperatureLog } from '@/data/types'
import { formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { AddApplianceModal } from './AddApplianceModal'
import { failText, isApplianceItem, targetText } from './thresholds'

export function ReadingBadge({ log }: { log: TemperatureLog | undefined }) {
  if (!log) return <Badge icon={<CircleAlert className="size-3.5" />}>No reading yet</Badge>
  return log.outcome === 'fail' ? (
    <Badge tone="fail" icon={<CircleAlert className="size-3.5" />}>
      Out of range
    </Badge>
  ) : (
    <Badge tone="pass" icon={<Check className="size-3.5" />}>
      In range
    </Badge>
  )
}

/** Every appliance, with the last thing it read. */
export function TempsPage() {
  const now = useNow()
  const { data } = useStore()
  const goBack = useGoBack('/more')
  const [adding, setAdding] = useState(false)

  const appliances = useMemo(() => {
    const latest = new Map<string, TemperatureLog>()
    // Logs are newest first, so the first one seen for each is its latest.
    for (const log of data.temperatureLogs) if (!latest.has(log.itemId)) latest.set(log.itemId, log)
    return data.items
      .filter((item) => item.active && isApplianceItem(item))
      .map((item) => ({ item, log: latest.get(item.id) }))
  }, [data.items, data.temperatureLogs])
  const outOfRange = appliances.filter((entry) => entry.log?.outcome === 'fail').length

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Temps" onBack={goBack} />
      <p className="text-ink-muted text-[13px]">
        {data.settings.venueName} · {format(now, 'EEE d MMM yyyy')}
      </p>

      {appliances.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No appliances yet"
          description="Add your fridges and freezers to keep their temperature records together."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-ink text-[15px] font-semibold">
              {appliances.length} {appliances.length === 1 ? 'appliance' : 'appliances'}
            </p>
            {outOfRange > 0 ? (
              <Badge tone="fail" icon={<CircleAlert className="size-3.5" />}>
                {outOfRange} out of range
              </Badge>
            ) : null}
          </div>
          <ul className="space-y-2.5">
            {appliances.map(({ item, log }) => (
              <li key={item.id}>
                <ListCard
                  to={`/temperatures/appliance/${item.id}`}
                  icon={Thermometer}
                  title={item.name}
                  subtitle={
                    log
                      ? `${format(parseISO(log.recordedAt), 'd MMM HH:mm')} · ${staffName(data, log.recordedBy)}`
                      : `${targetText(item)} · Fails ${failText(item).toLowerCase()}`
                  }
                >
                  <span className="flex items-center justify-between gap-3">
                    {log ? <span className="text-ink text-xl font-bold tabular-nums">{formatTemp(log.temperature)}</span> : <span />}
                    <ReadingBadge log={log} />
                  </span>
                </ListCard>
              </li>
            ))}
          </ul>
          <Link
            to="/temperatures/records"
            className="text-brand-700 dark:text-brand-300 flex items-center gap-1 py-1 text-sm font-semibold"
          >
            Today’s checks and full history
            <ChevronRight className="size-4" />
          </Link>
        </>
      )}

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setAdding(true)}>
          Add appliance
        </Button>
      </PinnedAction>
      {adding ? <AddApplianceModal onClose={() => setAdding(false)} /> : null}
    </div>
  )
}
