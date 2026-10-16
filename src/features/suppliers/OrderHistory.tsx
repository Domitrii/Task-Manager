import { Repeat } from 'lucide-react'
import { orderHistoryDate } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { Supplier, SupplierOrder } from '@/data/types'
import { discrepancyCount, orderState } from '@/lib/compliance'
import { formatWeekdayDate } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DeliveryStatusBadge, DiscrepancyBadge, OrderStatusBadge } from '@/components/shared/StatusBadge'
import { orderSummary, productList } from './orders'

/**
 * Received and cancelled orders, newest first. Each opens to show what came,
 * and any of them can be repeated as a new order.
 */
export function OrderHistoryList({
  orders,
  onOpen,
  onRepeat,
}: {
  orders: SupplierOrder[]
  onOpen: (order: SupplierOrder) => void
  /** Managers only. */
  onRepeat?: (order: SupplierOrder) => void
}) {
  const now = useNow()
  const { data } = useStore()

  return (
    <ul className="divide-line divide-y">
      {orders.map((order) => {
        const delivery = order.deliveryId ? data.deliveries.find((entry) => entry.id === order.deliveryId) : undefined
        const state = orderState(order, now)
        const when = order.status === 'received' ? order.receivedAt : order.status === 'cancelled' ? order.cancelledAt : undefined
        return (
          <li key={order.id} className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => onOpen(order)}
              className="hover:bg-surface-muted/60 min-w-0 flex-1 rounded-lg px-2 py-2.5 text-left transition-colors"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-ink text-[13px] font-medium">
                  {state === 'cancelled' ? 'Cancelled' : 'Delivered'}{' '}
                  {formatWeekdayDate(when ?? orderHistoryDate(order))}
                </span>
                <OrderStatusBadge state={state} />
                {delivery ? <DiscrepancyBadge count={discrepancyCount(delivery)} /> : null}
                {delivery && delivery.status !== 'accepted' ? <DeliveryStatusBadge status={delivery.status} /> : null}
              </span>
              <span className="text-ink-muted mt-0.5 block text-xs">{orderSummary(order.lines)}</span>
              <span className="text-ink-subtle mt-0.5 block truncate text-[11px]">{productList(order.lines)}</span>
            </button>
            {onRepeat ? (
              <IconButton label="Repeat this order" size="sm" className="mt-2" onClick={() => onRepeat(order)}>
                <Repeat className="size-4" />
              </IconButton>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function OrderHistoryModal({
  supplier,
  orders,
  onClose,
  onOpen,
  onRepeat,
}: {
  supplier: Supplier
  orders: SupplierOrder[]
  onClose: () => void
  onOpen: (order: SupplierOrder) => void
  onRepeat?: (order: SupplierOrder) => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`${supplier.name}: past orders`}
      description={`${orders.length} received or cancelled. Open one to see what came, or repeat it.`}
      size="lg"
    >
      <div className="-mx-2">
        <OrderHistoryList orders={orders} onOpen={onOpen} onRepeat={onRepeat} />
      </div>
    </Modal>
  )
}
