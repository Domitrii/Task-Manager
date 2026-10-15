import { useMemo, useState } from 'react'
import { History, Pencil } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { MonitoredItem, TemperatureLog } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { formatDateShort, formatTemp, formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn, titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import { CardList, Td, Th, TableWrap, Tr } from '@/components/ui/Table'
import { OutcomeBadge } from '@/components/shared/StatusBadge'
import { canEditReading, useReadingAccess } from './access'
import { EditReadingModal } from './EditReadingModal'
import { ReadingPhoto } from './ReadingPhoto'

type OutcomeFilter = 'all' | 'pass' | 'fail'

/** Entered this long after the time it's down for, it says so: the time was set by hand. */
const LATE_ENTRY_MS = 15 * 60_000

function enteredLate(log: TemperatureLog): boolean {
  return Boolean(log.enteredAt) && Date.parse(log.enteredAt ?? '') - Date.parse(log.recordedAt) > LATE_ENTRY_MS
}

/**
 * Full audit trail for a section. This is what gets shown to an inspector:
 * each reading with its photo, when it was really entered, and whether it has
 * been changed since. Readings can be changed from here by whoever may.
 */
export function TemperatureHistoryTable({
  logs,
  items,
}: {
  logs: TemperatureLog[]
  items: MonitoredItem[]
}) {
  const now = useNow()
  const { data } = useStore()
  const access = useReadingAccess()
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = editingId ? data.temperatureLogs.find((log) => log.id === editingId) : undefined
  const [itemFilter, setItemFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all')
  const [limit, setLimit] = useState(25)

  const filtered = useMemo(
    () =>
      logs
        .filter((log) => itemFilter === 'all' || log.itemId === itemFilter)
        .filter((log) => outcomeFilter === 'all' || log.outcome === outcomeFilter),
    [logs, itemFilter, outcomeFilter],
  )

  const visible = filtered.slice(0, limit)

  return (
    <div>
      <div className="border-line flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Select
          value={itemFilter}
          className="w-auto min-w-44"
          aria-label="Filter by equipment"
          onChange={(event) => setItemFilter(event.target.value)}
        >
          <option value="all">All equipment</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          value={outcomeFilter}
          className="w-auto min-w-36"
          aria-label="Filter by outcome"
          onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}
        >
          <option value="all">All outcomes</option>
          <option value="pass">In range only</option>
          <option value="fail">Out of range only</option>
        </Select>
        <p className="text-ink-muted ml-auto text-[13px]">
          {filtered.length} record{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title="No records match"
          description="Adjust the filters, or record a new reading."
        />
      ) : (
        <>
          <CardList showBelow="md">
            {visible.map((log) => {
              const item = data.items.find((entry) => entry.id === log.itemId)
              return (
                <li key={log.id} className="flex items-start gap-2 py-3 pr-2 pl-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-ink min-w-0 truncate text-sm font-medium">{item?.name ?? '—'}</span>
                      <span
                        className={cn(
                          'tabular shrink-0 text-sm font-semibold',
                          log.outcome === 'fail' ? 'text-fail-600 dark:text-fail-500' : 'text-ink',
                        )}
                      >
                        {formatTemp(log.temperature)}
                      </span>
                    </div>
                    <p className="text-ink-muted mt-0.5 text-xs">
                      {formatDateShort(log.recordedAt)}, <span className="tabular">{formatTime(log.recordedAt)}</span> ·{' '}
                      {log.period ? titleCase(log.period) : 'Ad-hoc'} · {staffName(data, log.recordedBy)}
                    </p>
                    {log.enteredAt && enteredLate(log) ? (
                      <p className="text-warn-700 dark:text-warn-500 text-[11px]">
                        Entered {formatDateShort(log.enteredAt)}, {formatTime(log.enteredAt)}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <OutcomeBadge outcome={log.outcome} />
                      {log.edits?.length ? <Badge tone="info">Changed</Badge> : null}
                    </div>
                    {log.correctiveAction ? (
                      <p className="text-ink-muted mt-1 text-[11px] leading-4">{log.correctiveAction}</p>
                    ) : null}
                  </div>
                  <ReadingPhoto log={log} />
                  {canEditReading(log, access, now) ? (
                    <IconButton label="Change this reading" size="sm" onClick={() => setEditingId(log.id)}>
                      <Pencil className="size-4" />
                    </IconButton>
                  ) : null}
                </li>
              )
            })}
          </CardList>

          <TableWrap hideBelow="md">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Equipment</Th>
                <Th numeric>Reading</Th>
                <Th>Status</Th>
                <Th>Check</Th>
                <Th>Recorded by</Th>
                <Th>Photo</Th>
                <Th>
                  <span className="sr-only">Change</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((log) => {
                const item = data.items.find((entry) => entry.id === log.itemId)
                const person = data.staff.find((entry) => entry.id === log.recordedBy)
                return (
                  <Tr key={log.id}>
                    <Td>
                      <span className="text-ink block text-[13px] font-medium">
                        {formatDateShort(log.recordedAt)}
                      </span>
                      <span className="text-ink-subtle tabular text-[11px]">
                        {formatTime(log.recordedAt)}
                      </span>
                      {log.enteredAt && enteredLate(log) ? (
                        <span className="text-warn-700 dark:text-warn-500 block text-[11px]">
                          Entered {formatDateShort(log.enteredAt)}, {formatTime(log.enteredAt)}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-ink block text-[13px] font-medium">{item?.name ?? '—'}</span>
                      <span className="text-ink-subtle text-[11px]">
                        {item ? formatRange(item) : ''}
                      </span>
                    </Td>
                    <Td numeric>
                      <span
                        className={
                          log.outcome === 'fail'
                            ? 'text-fail-600 dark:text-fail-500 text-sm font-semibold'
                            : 'text-ink text-sm font-semibold'
                        }
                      >
                        {formatTemp(log.temperature)}
                      </span>
                      {log.edits?.length ? (
                        <Badge tone="info" className="ml-1.5">
                          Changed
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      <OutcomeBadge outcome={log.outcome} />
                      {log.correctiveAction ? (
                        <p className="text-ink-muted mt-1 max-w-xs text-[11px] leading-4">
                          {log.correctiveAction}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-ink-muted text-[13px]">
                        {log.period ? titleCase(log.period) : 'Ad-hoc'}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Avatar person={person} size="xs" />
                        <span className="text-ink-muted text-[13px]">
                          {staffName(data, log.recordedBy)}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <ReadingPhoto log={log} />
                    </Td>
                    <Td>
                      {canEditReading(log, access, now) ? (
                        <IconButton label="Change this reading" size="sm" onClick={() => setEditingId(log.id)}>
                          <Pencil className="size-4" />
                        </IconButton>
                      ) : null}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </TableWrap>

          {editing ? <EditReadingModal log={editing} onClose={() => setEditingId(null)} /> : null}

          {filtered.length > visible.length ? (
            <div className="border-line border-t px-4 py-3 text-center sm:px-5">
              <Button size="sm" onClick={() => setLimit((current) => current + 50)}>
                Show more ({filtered.length - visible.length} remaining)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
