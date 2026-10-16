import { useState } from 'react'
import { addDays } from 'date-fns'
import { useStore } from '@/data/store'
import type { SupplierOrder } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { formatWeekdayDate } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { orderSummary } from './orders'

/** Calls an order off. It stays in the supplier's history and can still be repeated. */
export function CancelOrderModal({ order, onClose }: { order: SupplierOrder; onClose: () => void }) {
  const { data, cancelOrder } = useStore()
  const toast = useToast()
  const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)

  function handleCancel() {
    cancelOrder(order.id)
    toast.success('Order cancelled', `${supplier?.name ?? 'Supplier'} · kept in its order history`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel this order?"
      description={`${supplier?.name ?? 'Supplier'} · ${orderSummary(order.lines)}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep order
          </Button>
          <Button variant="danger" onClick={handleCancel}>
            Cancel order
          </Button>
        </>
      }
    >
      <p className="text-ink-muted text-sm">
        It stays in {supplier?.name ?? 'the supplier'}’s history, marked cancelled with your name, and can still be
        repeated. Let the supplier know yourself: they don’t see orders in the app.
      </p>
    </Modal>
  )
}

/** A new delivery date for an order that didn't arrive when it should have. */
export function MoveDeliveryModal({ order, onClose }: { order: SupplierOrder; onClose: () => void }) {
  const now = useNow()
  const { data, moveOrderDelivery } = useStore()
  const toast = useToast()
  const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)
  const today = toISODate(now)
  const [date, setDate] = useState(() => toISODate(addDays(new Date(), 1)))
  const [submitted, setSubmitted] = useState(false)
  const error = date === '' ? 'Pick the new delivery date.' : date < today ? 'Pick today or a later day.' : undefined

  function handleSave() {
    setSubmitted(true)
    if (error) return
    moveOrderDelivery(order.id, date)
    toast.success('Delivery date moved', `${supplier?.name ?? 'Supplier'} · now ${formatWeekdayDate(date)}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Move delivery date"
      description={`${supplier?.name ?? 'Supplier'} · was due ${order.deliveryDate ? formatWeekdayDate(order.deliveryDate) : 'without a date'}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Move date
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="New delivery date"
          htmlFor="move-delivery-date"
          hint="The order goes back to expected until then."
          error={submitted ? error : undefined}
        >
          <TextInput
            id="move-delivery-date"
            type="date"
            value={date}
            min={today}
            invalid={submitted && Boolean(error)}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        {order.orderBy && date !== '' && order.orderBy > date ? (
          <p className="text-ink-muted text-[13px]">
            Its order-by date ({formatWeekdayDate(order.orderBy)}) is after this, so it will be cleared.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
