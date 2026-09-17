import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { MonitoredItem, TemperatureLog } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { formatDateShort, formatTemp, formatTime } from '@/lib/format'
import { titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import { Td, Th, TableWrap, Tr } from '@/components/ui/Table'
import { OutcomeBadge } from '@/components/shared/StatusBadge'

type OutcomeFilter = 'all' | 'pass' | 'fail'

/** Full audit trail for a section. This is what gets shown to an inspector. */
export function TemperatureHistoryTable({
  logs,
  items,
}: {
  logs: TemperatureLog[]
  items: MonitoredItem[]
}) {
  const { data } = useStore()
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
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Equipment</Th>
                <Th numeric>Reading</Th>
                <Th>Status</Th>
                <Th>Check</Th>
                <Th>Recorded by</Th>
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
                  </Tr>
                )
              })}
            </tbody>
          </TableWrap>

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
