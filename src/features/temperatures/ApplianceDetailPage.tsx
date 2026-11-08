import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { TriangleAlert } from 'lucide-react'
import { enteredNote } from '@/data/attribution'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useQuickEntry } from '@/components/layout/quickEntry'
import { InfoCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { ShowQrButton } from '@/features/qr/ShowQrButton'
import { failText, targetText } from './thresholds'
import { ReadingBadge } from './TempsPage'

/** How many past readings to show; the full record is on the history tab. */
const HISTORY_LENGTH = 12

/** One appliance: where it stands, its limits and what it has read. */
export function ApplianceDetailPage() {
  const { id } = useParams()
  const { data } = useStore()
  const goBack = useGoBack('/temperatures')
  const quickEntry = useQuickEntry()
  const item = data.items.find((entry) => entry.id === id)
  const logs = useMemo(() => data.temperatureLogs.filter((log) => log.itemId === id), [data.temperatureLogs, id])

  if (!item) return <Navigate to="/temperatures" replace />

  const latest = logs[0]
  const stillOpen =
    latest?.outcome === 'fail' &&
    data.issues.some(
      (issue) => issue.linkedRecordId === latest.id && (issue.status !== 'resolved' || issue.needsSignOff),
    )

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title={item.name} onBack={goBack} />

      <InfoCard title="Latest reading">
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink text-[28px] leading-tight font-bold tabular-nums">
            {latest ? formatTemp(latest.temperature) : '—'}
          </p>
          <ReadingBadge log={latest} />
        </div>
        {latest ? (
          <p>
            Last recorded {format(parseISO(latest.recordedAt), 'd MMM HH:mm')} · {staffName(data, latest.recordedBy)}
          </p>
        ) : (
          <p>Added without a temperature reading.</p>
        )}
        {stillOpen ? (
          <Badge tone="warn" icon={<TriangleAlert className="size-3.5" />} className="mt-1">
            Needs sign-off
          </Badge>
        ) : null}
      </InfoCard>

      <InfoCard title="Configured thresholds">
        <p className="text-ink">
          {targetText(item)} · Fail {failText(item).toLowerCase()}
        </p>
        <p>Managers confirm real values and permissions; these are not safety guidance.</p>
      </InfoCard>

      <InfoCard title="Reading history · Oldest first">
        {logs.length === 0 ? (
          <p>No readings yet.</p>
        ) : (
          <ul className="divide-line divide-y">
            {logs
              .slice(0, HISTORY_LENGTH)
              .reverse()
              .map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="text-ink block text-sm font-semibold tabular-nums">{formatTemp(log.temperature)}</span>
                    <span className="block truncate text-xs">
                      {format(parseISO(log.recordedAt), 'd MMM HH:mm')} · {staffName(data, log.recordedBy)}
                      {enteredNote(data, log, log.recordedBy, log.recordedAt) ? ` · ${enteredNote(data, log, log.recordedBy, log.recordedAt)}` : ''}
                    </span>
                  </span>
                  <ReadingBadge log={log} />
                </li>
              ))}
          </ul>
        )}
      </InfoCard>

      <div className="flex items-center gap-1">
        <ShowQrButton item={item} />
        <span className="text-ink-muted text-[13px]">QR label for this appliance</span>
      </div>

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => quickEntry.recordTemperature({ itemId: item.id })}>
          Record reading
        </Button>
      </PinnedAction>
    </div>
  )
}
