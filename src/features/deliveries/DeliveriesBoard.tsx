import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ChevronRight, ClipboardList, Package } from 'lucide-react'
import { selectOrdersToCheckIn, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChipTabs } from '@/components/ui/Tabs'
import { useQuickEntry } from '@/components/layout/quickEntry'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { orderSummary } from '@/features/suppliers/orders'
import { ExpectedBadge, ReceivedBadge } from './DeliveryBadges'
import { worstTemperature } from './DeliveriesPage'

type Tab = 'expected' | 'received'

/** How far back the Received tab goes; older deliveries are in the records. */
const RECEIVED_DAYS = 7

/** What's coming in today and what has come in. */
export function DeliveriesBoard() {
  const now = useNow()
  const { data } = useStore()
  const goBack = useGoBack('/more')
  const quickEntry = useQuickEntry()
  const [tab, setTab] = useState<Tab>('expected')

  const supplierName = (id: string) => data.suppliers.find((entry) => entry.id === id)?.name ?? 'Unknown supplier'
  const { due, overdue } = useMemo(() => selectOrdersToCheckIn(data, now), [data, now])
  const expected = [...overdue, ...due]
  const received = useMemo(
    () =>
      data.deliveries.filter((delivery) => differenceInCalendarDays(now, parseISO(delivery.receivedAt)) < RECEIVED_DAYS),
    [data.deliveries, now],
  )

  const span = received.length
    ? [received[received.length - 1], received[0]].map((delivery) => format(parseISO(delivery.receivedAt), 'd MMM'))
    : []

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Deliveries" onBack={goBack} />

      <ChipTabs
        stretch
        label="Deliveries"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'expected', label: 'Expected' },
          { value: 'received', label: 'Received' },
        ]}
      />

      {tab === 'expected' ? (
        expected.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No deliveries expected"
            description="There are no expected deliveries for this venue. Received orders appear in the Received tab."
          />
        ) : (
          <>
            <p className="text-ink-muted text-[13px]">
              {expected.length} expected today · {format(now, 'EEE d MMM')}
            </p>
            <ul className="space-y-2.5">
              {expected.map((order) => {
                const late = overdue.includes(order)
                return (
                  <li key={order.id}>
                    <ListCard
                      to={`/deliveries/order/${order.id}`}
                      icon={Package}
                      title={supplierName(order.supplierId)}
                      subtitle={order.deliveryDate ? `Expected ${format(parseISO(order.deliveryDate), 'd MMM')}` : 'No date set'}
                    >
                      <ExpectedBadge overdue={late} />
                      <span className="text-ink-muted mt-1 block text-xs">{orderSummary(order.lines)}</span>
                    </ListCard>
                  </li>
                )
              })}
            </ul>
          </>
        )
      ) : received.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="Nothing received yet"
          description="Deliveries appear here once they’re checked in."
        />
      ) : (
        <>
          <p className="text-ink-muted text-[13px]">
            {received.length} received {received.length === 1 ? 'delivery' : 'deliveries'} ·{' '}
            {span[0] === span[1] ? span[0] : `${span[0]} – ${span[1]}`}
          </p>
          <ul className="space-y-2.5">
            {received.map((delivery) => {
              const { worst } = worstTemperature(delivery, data.settings)
              return (
                <li key={delivery.id}>
                  <ListCard
                    to={`/deliveries/received/${delivery.id}`}
                    icon={Package}
                    title={supplierName(delivery.supplierId)}
                    subtitle={`Received ${format(parseISO(delivery.receivedAt), 'd MMM HH:mm')} · ${staffName(data, delivery.checkedBy)}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-ink text-xl font-bold tabular-nums">
                        {worst ? formatTemp(worst.value) : '—'}
                      </span>
                      <ReceivedBadge status={delivery.status} />
                    </span>
                  </ListCard>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Link
        to="/deliveries/records"
        className="text-brand-700 dark:text-brand-300 flex items-center gap-1 py-1 text-sm font-semibold"
      >
        All deliveries, rejections and use-by dates
        <ChevronRight className="size-4" />
      </Link>

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={quickEntry.recordDelivery}>
          Log delivery
        </Button>
      </PinnedAction>
    </div>
  )
}
