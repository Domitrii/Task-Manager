import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, CircleAlert, ClipboardList, Flame, TriangleAlert } from 'lucide-react'
import { selectProbeCalibration } from '@/data/attention'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { TemperatureLog } from '@/data/types'
import { formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { useQuickEntry } from '@/components/layout/quickEntry'
import { InfoCard, ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { failText, isApplianceItem, targetText } from './thresholds'

/** Days of probe readings to show; older ones are on the full history. */
const DAYS_SHOWN = 7

export function FoodProbePage() {
  const now = useNow()
  const { data, activeStaff, updateSettings } = useStore()
  const toast = useToast()
  const goBack = useGoBack('/more')
  const quickEntry = useQuickEntry()
  const calibration = selectProbeCalibration(data, now)

  const days = useMemo(() => {
    const probes = new Map(data.items.filter((item) => !isApplianceItem(item)).map((item) => [item.id, item]))
    const byDay = new Map<string, TemperatureLog[]>()
    for (const log of data.temperatureLogs) {
      if (!probes.has(log.itemId)) continue
      const day = log.recordedAt.slice(0, 10)
      if (!byDay.has(day) && byDay.size === DAYS_SHOWN) break
      byDay.set(day, [...(byDay.get(day) ?? []), log])
    }
    return [...byDay].map(([day, logs]) => ({ day, logs, probes }))
  }, [data.items, data.temperatureLogs])

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Food probe" onBack={goBack} />

      <InfoCard title="Probe calibration">
        {calibration.needed ? (
          <Badge tone="warn" icon={<TriangleAlert className="size-3.5" />}>
            Needs check
          </Badge>
        ) : (
          <Badge tone="pass" icon={<Check className="size-3.5" />}>
            Up to date
          </Badge>
        )}
        <p className="text-ink mt-1">{calibration.detail}</p>
        <p>
          Calibration is separate from food temperature checks. Ask your duty manager about the venue’s calibration
          procedure.
        </p>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            updateSettings({ probeCalibratedAt: new Date().toISOString(), probeCalibratedBy: activeStaff.id })
            toast.success('Calibration recorded')
          }}
        >
          Record calibration
        </Button>
      </InfoCard>

      {days.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No food checks yet"
          description="Record a food probe check to start the history for this venue."
        />
      ) : (
        days.map(({ day, logs, probes }) => (
          <section key={day} aria-label={`Check history for ${day}`} className="space-y-2.5">
            <h2 className="text-ink text-[15px] font-semibold">Check history · {format(parseISO(day), 'd MMM')}</h2>
            {logs.map((log) => {
              const item = probes.get(log.itemId)
              return (
                <ListCard
                  key={log.id}
                  to={`/temperatures/appliance/${log.itemId}`}
                  icon={Flame}
                  title={item?.name ?? 'Reading'}
                  subtitle={`${format(parseISO(log.recordedAt), 'd MMM HH:mm')} · ${staffName(data, log.recordedBy)}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-ink text-xl font-bold tabular-nums">{formatTemp(log.temperature)}</span>
                    {log.outcome === 'fail' ? (
                      <Badge tone="fail" icon={<CircleAlert className="size-3.5" />}>
                        Failed
                      </Badge>
                    ) : (
                      <Badge tone="pass" icon={<Check className="size-3.5" />}>
                        Passed
                      </Badge>
                    )}
                  </span>
                  {item ? (
                    <span className="text-ink-muted mt-1 block text-xs">
                      {targetText(item)} · Fails {failText(item).toLowerCase()}
                      {log.correctiveAction ? `. ${log.correctiveAction}` : ''}
                    </span>
                  ) : null}
                </ListCard>
              )
            })}
          </section>
        ))
      )}

      <PinnedAction>
        <Button
          block
          size="lg"
          variant="primary"
          onClick={() => quickEntry.recordTemperature({ restrictTo: ['cooking', 'cooling'] })}
        >
          Add check
        </Button>
      </PinnedAction>
    </div>
  )
}
