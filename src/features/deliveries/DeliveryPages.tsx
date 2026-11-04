import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { selectOrdersToCheckIn, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { SupplierOrder } from '@/data/types'
import { formatQuantity, formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { useQuickEntry } from '@/components/layout/quickEntry'
import { InfoCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { CancelOrderModal, MoveDeliveryModal } from '@/features/suppliers/OrderActions'
import { useIsManager } from '@/features/temperatures/access'
import { CheckInModal } from './CheckInModal'
import { ExpectedBadge, ReceivedBadge } from './DeliveryBadges'
import { worstTemperature } from './DeliveriesPage'

type Sheet = 'check-in' | 'move' | 'cancel'

/** An order on its way: what's coming, and checking it in. */
export function ExpectedDeliveryPage() {
  const { id } = useParams()
  const now = useNow()
  const { data } = useStore()
  const manager = useIsManager()
  const goBack = useGoBack('/deliveries')
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const order: SupplierOrder | undefined = data.supplierOrders.find((entry) => entry.id === id)

  if (!order) return <Navigate to="/deliveries" replace />
  // Checking in turns it into a delivery, which has its own page.
  if (order.deliveryId) return <Navigate to={`/deliveries/received/${order.deliveryId}`} replace />

  const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)
  const overdue = selectOrdersToCheckIn(data, now).overdue.includes(order)
  const close = () => setSheet(null)

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Delivery" onBack={goBack} />

      <InfoCard title={supplier?.name ?? 'Unknown supplier'}>
        <ExpectedBadge overdue={overdue} />
        <p className="text-ink mt-1">
          {order.deliveryDate ? `Expected ${format(parseISO(order.deliveryDate), 'd MMM')}` : 'No delivery date yet'}
        </p>
        <p>Not received{order.notes ? ` · ${order.notes}` : ''}</p>
      </InfoCard>

      <InfoCard title="Expected items">
        {order.lines.map((line) => (
          <p key={line.id} className="text-ink">
            {line.product} · {formatQuantity(line.quantity, line.unit)}
          </p>
        ))}
        <p>Expected quantities only; receipt not yet logged.</p>
      </InfoCard>

      <InfoCard title="Arrival and decision">
        <p className="text-ink">Temperature · Not recorded</p>
        <p className="text-ink">Decision · Not received</p>
      </InfoCard>

      {manager ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setSheet('move')}>
            Move delivery date
          </Button>
          <Button size="sm" onClick={() => setSheet('cancel')}>
            Cancel order
          </Button>
        </div>
      ) : null}

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setSheet('check-in')}>
          Check in
        </Button>
      </PinnedAction>

      {sheet === 'check-in' ? <CheckInModal order={order} onClose={close} /> : null}
      {sheet === 'move' ? <MoveDeliveryModal order={order} onClose={close} /> : null}
      {sheet === 'cancel' ? <CancelOrderModal order={order} onClose={close} /> : null}
    </div>
  )
}

/** A delivery that's in: what came, and what was decided about it. */
export function ReceivedDeliveryPage() {
  const { id } = useParams()
  const { data } = useStore()
  const goBack = useGoBack('/deliveries')
  const quickEntry = useQuickEntry()
  const delivery = data.deliveries.find((entry) => entry.id === id)

  if (!delivery) return <Navigate to="/deliveries" replace />

  const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
  const who = staffName(data, delivery.checkedBy)
  const { worst } = worstTemperature(delivery, data.settings)
  const decision = { accepted: 'Accepted', partially_rejected: 'Part rejected', rejected: 'Rejected' }[delivery.status]

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Delivery" onBack={goBack} />

      <InfoCard title={supplier?.name ?? 'Unknown supplier'}>
        <ReceivedBadge status={delivery.status} />
        <p className="text-ink mt-1">Received {format(parseISO(delivery.receivedAt), 'd MMM HH:mm')}</p>
        <p>Received by {who}</p>
      </InfoCard>

      <InfoCard title="Received items">
        {delivery.lines.map((line) => (
          <p key={line.id} className="text-ink">
            {line.product} · {formatQuantity(line.quantity, line.unit)}
            {line.accepted ? '' : ' · Rejected'}
          </p>
        ))}
        {delivery.notReceived?.map((line) => (
          <p key={line.product}>{line.product} · Not received</p>
        ))}
      </InfoCard>

      <InfoCard title="Arrival and decision">
        <p className="text-ink">Arrival temperature · {worst ? formatTemp(worst.value) : 'Not recorded'}</p>
        <p className="text-ink">
          Decision · {decision} by {who}
        </p>
        {delivery.notes ? <p>{delivery.notes}</p> : null}
      </InfoCard>

      <Link
        to={`/deliveries/records?id=${delivery.id}`}
        className="text-brand-700 dark:text-brand-300 flex items-center gap-1 py-1 text-sm font-semibold"
      >
        Full record, with temperatures and use-by dates
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
