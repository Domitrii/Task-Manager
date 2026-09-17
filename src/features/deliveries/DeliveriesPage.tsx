import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Ban, CalendarClock, Package, Plus, Truck } from 'lucide-react'
import {
  selectDeliveriesForDay,
  selectExpiringStock,
  selectRejectedDeliveries,
  staffName,
} from '@/data/selectors'
import { useStore } from '@/data/store'
import type { Delivery } from '@/data/types'
import { deliveryTempLimit } from '@/lib/compliance'
import { formatDate, formatRelativeDay, formatTemp } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, TextInput } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DeliveryStatusBadge } from '@/components/shared/StatusBadge'
import { DeliveryDetailModal } from './DeliveryDetailModal'
import { DeliveryFormModal } from './DeliveryFormModal'

type TabKey = 'all' | 'today' | 'rejections' | 'useby'

export function DeliveriesPage() {
  const now = useNow()
  const { data } = useStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useState<TabKey>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Delivery | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)

  // The opened delivery lives in the URL rather than in state, so a dashboard
  // link, a back button and a row click all go through one code path.
  const selectedId = searchParams.get('id') ?? undefined
  const setSelectedId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (id) next.set('id', id)
          else next.delete('id')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const today = useMemo(() => selectDeliveriesForDay(data, now), [data, now])
  const rejected = useMemo(() => selectRejectedDeliveries(data, 30, now), [data, now])
  const expiring = useMemo(() => selectExpiringStock(data, 2, now), [data, now])

  const rejectedLineCount = useMemo(
    () => rejected.reduce((total, delivery) => total + delivery.lines.filter((line) => !line.accepted).length, 0),
    [rejected],
  )

  const source = tab === 'today' ? today : tab === 'rejections' ? rejected : data.deliveries

  const filtered = useMemo(
    () =>
      source
        .filter((delivery) => supplierFilter === 'all' || delivery.supplierId === supplierFilter)
        .filter((delivery) => {
          const needle = query.trim().toLowerCase()
          if (!needle) return true
          const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
          return (
            `${supplier?.name ?? ''} ${delivery.deliveryNote ?? ''} ${delivery.driverName ?? ''}`
              .toLowerCase()
              .includes(needle) ||
            delivery.lines.some((line) => line.product.toLowerCase().includes(needle))
          )
        }),
    [source, supplierFilter, query, data.suppliers],
  )

  const selected = data.deliveries.find((delivery) => delivery.id === selectedId)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deliveries & goods receiving"
        description="Every delivery checked in by hand: temperatures, packaging condition, dates and who signed for it."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Record delivery
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Deliveries today"
          value={today.length}
          sublabel={`${today.reduce((total, delivery) => total + delivery.lines.length, 0)} lines checked`}
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Rejections (30 days)"
          value={rejectedLineCount}
          sublabel={`across ${rejected.length} deliver${rejected.length === 1 ? 'y' : 'ies'}`}
          icon={<Ban className="size-4" />}
          tone={rejectedLineCount > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="Use-by within 2 days"
          value={expiring.length}
          sublabel="Accepted lines approaching their date"
          icon={<CalendarClock className="size-4" />}
          tone={expiring.some((entry) => entry.daysLeft < 0) ? 'fail' : expiring.length > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="Active suppliers"
          value={data.suppliers.filter((supplier) => supplier.active).length}
          sublabel="Manually maintained in settings"
          icon={<Truck className="size-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All deliveries', count: data.deliveries.length },
              { value: 'today', label: 'Today', count: today.length },
              { value: 'rejections', label: 'Rejections', count: rejected.length },
              { value: 'useby', label: 'Use-by watch', count: expiring.length },
            ]}
          />
        </div>

        {tab === 'useby' ? (
          <UseByList entries={expiring} onOpen={setSelectedId} />
        ) : (
          <>
            <div className="border-line flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
              <TextInput
                value={query}
                placeholder="Search supplier, product or note"
                className="w-auto min-w-52 flex-1 sm:max-w-xs"
                onChange={(event) => setQuery(event.target.value)}
              />
              <Select
                value={supplierFilter}
                className="w-auto min-w-44"
                aria-label="Filter by supplier"
                onChange={(event) => setSupplierFilter(event.target.value)}
              >
                <option value="all">All suppliers</option>
                {data.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
              <p className="text-ink-muted ml-auto text-[13px]">
                {filtered.length} deliver{filtered.length === 1 ? 'y' : 'ies'}
              </p>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Package className="size-5" />}
                title="No deliveries to show"
                description="Try a different filter, or record the delivery that has just arrived."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditing(undefined)
                      setFormOpen(true)
                    }}
                  >
                    Record delivery
                  </Button>
                }
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Supplier</Th>
                    <Th>Received</Th>
                    <Th>Products</Th>
                    <Th>Temperatures</Th>
                    <Th>Status</Th>
                    <Th>Checked by</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 60).map((delivery) => {
                    const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
                    const person = data.staff.find((entry) => entry.id === delivery.checkedBy)
                    const temps = delivery.lines.filter((line) => line.temperature !== null)
                    const worst = temps.reduce<{ value: number; failed: boolean } | null>((acc, line) => {
                      const limit = deliveryTempLimit(line, data.settings)
                      const failed = limit !== null && line.temperature !== null && line.temperature > limit
                      if (!acc || (failed && !acc.failed)) return { value: line.temperature as number, failed }
                      return acc
                    }, null)

                    return (
                      <Tr key={delivery.id} onClick={() => setSelectedId(delivery.id)}>
                        <Td>
                          <span className="text-ink block text-[13px] font-medium">{supplier?.name}</span>
                          {delivery.deliveryNote ? (
                            <span className="text-ink-subtle text-[11px]">{delivery.deliveryNote}</span>
                          ) : null}
                        </Td>
                        <Td>
                          <span className="text-ink-muted text-[13px]">
                            {formatRelativeDay(delivery.receivedAt)}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-ink-muted text-[13px]">
                            {delivery.lines.length} line{delivery.lines.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-ink-subtle block max-w-52 truncate text-[11px]">
                            {delivery.lines.map((line) => line.product).join(', ')}
                          </span>
                        </Td>
                        <Td>
                          {worst ? (
                            <span
                              className={cn(
                                'tabular text-[13px] font-medium',
                                worst.failed ? 'text-fail-600 dark:text-fail-500' : 'text-ink',
                              )}
                            >
                              {formatTemp(worst.value)}
                              {temps.length > 1 ? (
                                <span className="text-ink-subtle font-normal"> · {temps.length} probed</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-ink-subtle text-[13px]">Ambient</span>
                          )}
                        </Td>
                        <Td>
                          <DeliveryStatusBadge status={delivery.status} />
                        </Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            <Avatar person={person} size="xs" />
                            <span className="text-ink-muted text-[13px]">
                              {staffName(data, delivery.checkedBy)}
                            </span>
                          </span>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </TableWrap>
            )}
          </>
        )}
      </Card>

      <DeliveryDetailModal
        delivery={selected}
        onClose={() => setSelectedId(undefined)}
        onEdit={(delivery) => {
          setSelectedId(undefined)
          setEditing(delivery)
          setFormOpen(true)
        }}
      />
      {/* Mounted only while open so the form seeds fresh from `editing`. */}
      {formOpen ? (
        <DeliveryFormModal
          open
          existing={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

function UseByList({
  entries,
  onOpen,
}: {
  entries: ReturnType<typeof selectExpiringStock>
  onOpen: (id: string) => void
}) {
  const { data } = useStore()

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-5" />}
        title="Nothing approaching its use-by date"
        description="Accepted delivery lines are checked against the dates entered on receipt."
      />
    )
  }

  return (
    <ul className="divide-line divide-y">
      {entries.map(({ delivery, line, daysLeft }) => {
        const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
        return (
          <li key={`${delivery.id}-${line.id}`}>
            <button
              type="button"
              onClick={() => onOpen(delivery.id)}
              className="hover:bg-surface-muted/60 flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5"
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  daysLeft < 0
                    ? 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500'
                    : 'bg-warn-50 text-warn-600 dark:bg-warn-500/12 dark:text-warn-500',
                )}
              >
                <AlertTriangle className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-medium">{line.product}</p>
                <p className="text-ink-muted truncate text-xs">
                  {supplier?.name} · delivered {formatRelativeDay(delivery.receivedAt)}
                </p>
              </div>
              <Badge tone={daysLeft < 0 ? 'fail' : 'warn'}>
                {daysLeft < 0
                  ? `Expired ${Math.abs(daysLeft)}d ago`
                  : daysLeft === 0
                    ? 'Use by today'
                    : `${daysLeft}d left`}
              </Badge>
              <span className="text-ink-subtle text-xs">{line.useBy ? formatDate(line.useBy) : ''}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
