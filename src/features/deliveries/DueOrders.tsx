import { useMemo, useState } from 'react'
import { CalendarClock, ClipboardCheck, Truck } from 'lucide-react'
import { selectOrdersToCheckIn } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { SupplierOrder } from '@/data/types'
import { daysUntil, orderState } from '@/lib/compliance'
import { formatWeekdayDate } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { OrderStatusBadge } from '@/components/shared/StatusBadge'
import { CancelOrderModal, MoveDeliveryModal } from '@/features/suppliers/OrderActions'
import { OrderDetailModal } from '@/features/suppliers/OrderDetailModal'
import { OrderFormModal } from '@/features/suppliers/OrderFormModal'
import { orderSummary, productList } from '@/features/suppliers/orders'
import { useIsManager } from '@/features/temperatures/access'
import { CheckInModal } from './CheckInModal'

type Sheet = { type: 'checkin' | 'move' | 'cancel' | 'detail' | 'edit'; order: SupplierOrder }

/**
 * Orders arriving today, and any that should have arrived and weren't checked
 * in, at the top of Deliveries where whoever takes the delivery will look.
 * Anyone can check one in; moving or cancelling an overdue one is for managers.
 */
export function DueOrders() {
  const now = useNow()
  const { data } = useStore()
  const manager = useIsManager()
  const { due, overdue } = useMemo(() => selectOrdersToCheckIn(data, now), [data, now])
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = () => setSheet(null)

  const orders = [...overdue, ...due]
  // The sheet stays open while its order rolls out of this list, e.g. once checked in.
  if (orders.length === 0 && !sheet) return null

  return (
    <>
      {orders.length > 0 ? (
        <section
          aria-labelledby="due-today"
          className="border-brand-500/45 bg-brand-50/80 dark:bg-brand-500/8 rounded-card shadow-card border p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="bg-brand-600 flex size-10 shrink-0 items-center justify-center rounded-xl text-white">
              <Truck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="due-today" className="text-ink flex items-center gap-2 text-[17px] leading-6 font-bold">
                Due today
                <span className="bg-brand-600 tabular min-w-6 rounded-full px-1.5 text-center text-xs leading-5 font-bold text-white">
                  {orders.length}
                </span>
              </h2>
              <p className="text-ink-muted mt-0.5 text-[13px]">
                {due.length > 0
                  ? `${due.length} order${due.length === 1 ? '' : 's'} arriving today`
                  : 'Nothing else is due today'}
                {overdue.length > 0
                  ? `, and ${overdue.length} that didn’t arrive on ${overdue.length === 1 ? 'its' : 'their'} day`
                  : ''}
                . Check each one in as it comes, so it’s recorded against the order.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {orders.map((order) => {
              const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)
              const state = orderState(order, now)
              const late = state === 'overdue' && order.deliveryDate ? -daysUntil(order.deliveryDate, now) : 0
              return (
                <li
                  key={order.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border p-3 sm:p-3.5',
                    state === 'overdue'
                      ? 'border-fail-500/50 bg-fail-50 dark:bg-fail-500/10'
                      : 'border-line bg-surface',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSheet({ type: 'detail', order })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-ink text-sm font-semibold">{supplier?.name ?? 'Supplier'}</span>
                      <OrderStatusBadge state={state} />
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-xs',
                        state === 'overdue' ? 'text-fail-700 dark:text-fail-500 font-medium' : 'text-ink-muted',
                      )}
                    >
                      {state === 'overdue' && order.deliveryDate
                        ? `Was due ${formatWeekdayDate(order.deliveryDate)} · ${late} day${late === 1 ? '' : 's'} late`
                        : 'Delivery today'}
                      <span className="text-ink-muted font-normal"> · {orderSummary(order.lines)}</span>
                    </span>
                    <span className="text-ink-subtle mt-0.5 block truncate text-[11px]">{productList(order.lines)}</span>
                  </button>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <Button size="sm" variant="primary" onClick={() => setSheet({ type: 'checkin', order })}>
                      <ClipboardCheck className="size-4" />
                      Check in
                    </Button>
                    {state === 'overdue' && manager ? (
                      <>
                        <Button size="sm" onClick={() => setSheet({ type: 'move', order })}>
                          <CalendarClock className="size-4" />
                          Move delivery date
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSheet({ type: 'cancel', order })}>
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/* Mounted only while open, so each one starts from the order as it is now. */}
      {sheet?.type === 'checkin' ? <CheckInModal order={sheet.order} onClose={close} /> : null}
      {sheet?.type === 'move' ? <MoveDeliveryModal order={sheet.order} onClose={close} /> : null}
      {sheet?.type === 'cancel' ? <CancelOrderModal order={sheet.order} onClose={close} /> : null}
      {sheet?.type === 'edit' ? (
        <OrderFormModal supplierId={sheet.order.supplierId} existing={sheet.order} onClose={close} />
      ) : null}
      {sheet?.type === 'detail' ? (
        <OrderDetailModal
          order={data.supplierOrders.find((order) => order.id === sheet.order.id)}
          onClose={close}
          onCheckIn={(order) => setSheet({ type: 'checkin', order })}
          onEdit={manager ? (order) => setSheet({ type: 'edit', order }) : undefined}
          onCancel={manager ? (order) => setSheet({ type: 'cancel', order }) : undefined}
        />
      ) : null}
    </>
  )
}
