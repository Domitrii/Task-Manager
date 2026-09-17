import { AlertTriangle, MapPin } from 'lucide-react'
import { CATEGORY_ICONS } from '@/config/navigation'
import { useStore } from '@/data/store'
import type { MonitoredItem, TemperatureLog } from '@/data/types'
import { formatRange, isBorderline } from '@/lib/compliance'
import { formatAgo, formatTemp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { staffName } from '@/data/selectors'

/** Current state of every item in a section — the "is anything wrong now?" view. */
export function EquipmentStatusGrid({
  readings,
  onRecord,
}: {
  readings: Array<{ item: MonitoredItem; log?: TemperatureLog }>
  onRecord: (item: MonitoredItem) => void
}) {
  const { data } = useStore()

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {readings.map(({ item, log }) => {
        const Icon = CATEGORY_ICONS[item.category]
        const failed = log?.outcome === 'fail'
        const borderline = log ? isBorderline(item, log) : false

        return (
          <div
            key={item.id}
            className={cn(
              'bg-surface rounded-card flex flex-col border p-4 shadow-card transition-colors',
              failed ? 'border-fail-500/40' : 'border-line',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  failed
                    ? 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500'
                    : 'bg-surface-muted text-ink-muted',
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-semibold">{item.name}</p>
                <p className="text-ink-muted flex items-center gap-1 truncate text-xs">
                  <MapPin className="size-3 shrink-0" />
                  {item.location}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p
                  className={cn(
                    'tabular text-3xl leading-9 font-semibold',
                    !log
                      ? 'text-ink-subtle'
                      : failed
                        ? 'text-fail-600 dark:text-fail-500'
                        : 'text-ink',
                  )}
                >
                  {log ? formatTemp(log.temperature) : '—'}
                </p>
                <p className="text-ink-muted mt-0.5 text-xs">Safe range {formatRange(item)}</p>
              </div>
              {log ? (
                failed ? (
                  <Badge tone="fail" icon={<AlertTriangle className="size-3.5" />}>
                    Out of range
                  </Badge>
                ) : borderline ? (
                  <Badge tone="warn">Near limit</Badge>
                ) : (
                  <Badge tone="pass">In range</Badge>
                )
              ) : (
                <Badge tone="neutral">No reading</Badge>
              )}
            </div>

            <div className="border-line mt-4 flex items-center justify-between gap-2 border-t pt-3">
              <p className="text-ink-subtle min-w-0 truncate text-[11px]">
                {log
                  ? `${formatAgo(log.recordedAt)} · ${staffName(data, log.recordedBy)}`
                  : 'Never recorded'}
              </p>
              <Button size="sm" onClick={() => onRecord(item)}>
                Record
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
