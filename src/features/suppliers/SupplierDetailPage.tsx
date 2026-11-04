import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { selectUpcomingOrders, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { InfoCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { worstTemperature } from '@/features/deliveries/DeliveriesPage'
import { AddSupplierModal } from './AddSupplierModal'
import { deliveryDaysText } from './SuppliersListPage'

/** How many past deliveries to list; every one is on Orders and in the records. */
const HISTORY_LENGTH = 5

export function SupplierDetailPage() {
  const { id } = useParams()
  const now = useNow()
  const { data } = useStore()
  const goBack = useGoBack('/suppliers')
  const [editing, setEditing] = useState(false)
  const supplier = data.suppliers.find((entry) => entry.id === id)

  const received = useMemo(() => data.deliveries.filter((entry) => entry.supplierId === id), [data.deliveries, id])
  const expected = useMemo(
    () => selectUpcomingOrders(data, now).filter((entry) => entry.supplierId === id),
    [data, now, id],
  )

  if (!supplier) return <Navigate to="/suppliers" replace />

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Supplier" onBack={goBack} />

      <InfoCard title={supplier.name}>
        <p className="text-ink">Delivery days · {deliveryDaysText(supplier) ?? 'Not added'}</p>
        <p>Supplier details for {data.settings.venueName}</p>
      </InfoCard>

      <InfoCard title="Contact">
        <p className="text-ink">Email · {supplier.email ?? 'Not added'}</p>
        <p className="text-ink">Phone · {supplier.phone ?? 'Not added'}</p>
        <p className="text-ink">Address · {supplier.address ?? 'Not added'}</p>
      </InfoCard>

      <InfoCard title="Delivery history">
        <p>
          {received.length} received · {expected.length} expected
        </p>
        {received.slice(0, HISTORY_LENGTH).map((delivery) => {
          const { worst } = worstTemperature(delivery, data.settings)
          const decision = { accepted: 'Accepted', partially_rejected: 'Part rejected', rejected: 'Rejected' }[delivery.status]
          return (
            <Link key={delivery.id} to={`/deliveries/received/${delivery.id}`} className="text-ink block py-0.5">
              {[
                format(parseISO(delivery.receivedAt), 'd MMM HH:mm'),
                worst ? formatTemp(worst.value) : null,
                `${decision} by ${staffName(data, delivery.checkedBy)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Link>
          )
        })}
        {expected.map((order) => (
          <p key={order.id} className="text-ink">
            {order.deliveryDate ? format(parseISO(order.deliveryDate), 'd MMM') : 'No date yet'} · Expected · Not received
          </p>
        ))}
      </InfoCard>

      <Link
        to="/suppliers/orders"
        className="text-brand-700 dark:text-brand-300 flex items-center gap-1 py-1 text-sm font-semibold"
      >
        Orders and upcoming deliveries
        <ChevronRight className="size-4" />
      </Link>

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setEditing(true)}>
          Edit supplier
        </Button>
      </PinnedAction>
      {editing ? <AddSupplierModal supplier={supplier} onClose={() => setEditing(false)} /> : null}
    </div>
  )
}
