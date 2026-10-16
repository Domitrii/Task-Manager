import { CalendarClock, ClipboardCheck, PackageX, Pencil, Repeat, Truck, User } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { Delivery, DeliveryLine, SupplierOrder, SupplierOrderLine } from '@/data/types'
import { discrepancyCount, isDiscrepancy, isShort, orderState, orderTotal } from '@/lib/compliance'
import { formatDateTime, formatMoney, formatQuantity, formatWeekdayDate, perUnit } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn, titleCase } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DeliveryStatusBadge, DiscrepancyBadge, OrderStatusBadge } from '@/components/shared/StatusBadge'
import { DetailRow } from '@/features/deliveries/DeliveryDetailModal'

/**
 * One order: what was ordered and at what price, and once it's checked in,
 * what actually arrived. Lines that came short, didn't come or have a note are
 * picked out in amber.
 */
export function OrderDetailModal({
  order,
  onClose,
  onEdit,
  onRepeat,
  onCancel,
  onCheckIn,
}: {
  order: SupplierOrder | undefined
  onClose: () => void
  /** Each action is offered only when given, so whoever can't do it doesn't see it. */
  onEdit?: (order: SupplierOrder) => void
  onRepeat?: (order: SupplierOrder) => void
  onCancel?: (order: SupplierOrder) => void
  onCheckIn?: (order: SupplierOrder) => void
}) {
  const now = useNow()
  const { data } = useStore()
  if (!order) return null

  const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)
  const state = orderState(order, now)
  const open = state !== 'received' && state !== 'cancelled'
  const delivery = order.deliveryId ? data.deliveries.find((entry) => entry.id === order.deliveryId) : undefined
  const ordered = orderTotal(order.lines)
  const extras = delivery?.lines.filter((line) => line.extra) ?? []
  const arrived = delivery ? orderTotal(delivery.lines) : undefined

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier?.name ?? 'Order'}
      description={
        order.deliveryDate ? `Order for ${formatWeekdayDate(order.deliveryDate)}` : 'Draft order: dates not set yet'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {open && onCancel ? (
            <Button variant="ghost" className="text-fail-700 dark:text-fail-500" onClick={() => onCancel(order)}>
              Cancel order
            </Button>
          ) : null}
          {onRepeat ? (
            <Button onClick={() => onRepeat(order)}>
              <Repeat className="size-4" />
              Repeat
            </Button>
          ) : null}
          {open && onEdit ? (
            <Button variant={onCheckIn && (state === 'due' || state === 'overdue') ? 'secondary' : 'primary'} onClick={() => onEdit(order)}>
              <Pencil className="size-4" />
              Edit order
            </Button>
          ) : null}
          {onCheckIn && (state === 'due' || state === 'overdue') ? (
            <Button variant="primary" onClick={() => onCheckIn(order)}>
              <ClipboardCheck className="size-4" />
              Check in
            </Button>
          ) : null}
          {delivery ? (
            <ButtonLink variant="primary" to={`/deliveries?id=${delivery.id}`}>
              Delivery record
            </ButtonLink>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge state={state} />
          {delivery ? <DiscrepancyBadge count={discrepancyCount(delivery)} /> : null}
          {delivery && delivery.status !== 'accepted' ? <DeliveryStatusBadge status={delivery.status} /> : null}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <DetailRow
            icon={<Truck className="size-4" />}
            label="Delivery"
            value={order.deliveryDate ? formatWeekdayDate(order.deliveryDate) : 'Not set yet'}
          />
          <DetailRow
            icon={<CalendarClock className="size-4" />}
            label="Order by"
            value={order.orderBy ? formatWeekdayDate(order.orderBy) : order.deliveryDate ? 'No deadline' : '—'}
          />
          <DetailRow
            icon={<User className="size-4" />}
            label="Ordered by"
            value={`${staffName(data, order.createdBy)}, ${formatDateTime(order.createdAt)}`}
          />
          {order.status === 'received' ? (
            <DetailRow
              icon={<ClipboardCheck className="size-4" />}
              label="Checked in by"
              value={`${staffName(data, order.receivedBy)}${order.receivedAt ? `, ${formatDateTime(order.receivedAt)}` : ''}`}
            />
          ) : order.status === 'cancelled' ? (
            <DetailRow
              icon={<PackageX className="size-4" />}
              label="Cancelled by"
              value={`${staffName(data, order.cancelledBy)}${order.cancelledAt ? `, ${formatDateTime(order.cancelledAt)}` : ''}`}
            />
          ) : null}
        </dl>

        <div>
          <h3 className="text-ink mb-2 text-sm font-semibold">
            {delivery ? 'Ordered and received' : 'Items'}
            <span className="text-ink-muted ml-1.5 font-normal">({order.lines.length})</span>
          </h3>
          <ul className="space-y-2">
            {order.lines.map((line) => (
              <OrderLineRow key={line.id} line={line} delivery={delivery} />
            ))}
          </ul>
        </div>

        {extras.length > 0 ? (
          <div>
            <h3 className="text-ink mb-2 text-sm font-semibold">
              Extras
              <span className="text-ink-muted ml-1.5 font-normal">brought on the day, not on the order</span>
            </h3>
            <ul className="space-y-2">
              {extras.map((line) => (
                <ExtraRow key={line.id} line={line} />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-line flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3">
          <span className="text-ink-muted text-sm">
            Order total
            {ordered.unpriced > 0 ? (
              <span className="text-ink-subtle"> · {ordered.unpriced} without a price</span>
            ) : null}
            {arrived && arrived.total !== ordered.total ? (
              <span className="text-ink-subtle"> · {formatMoney(arrived.total)} arrived</span>
            ) : null}
          </span>
          <span className="tabular text-ink text-lg font-bold">{formatMoney(ordered.total)}</span>
        </div>

        {order.notes ? (
          <div>
            <h3 className="text-ink mb-1 text-sm font-semibold">Notes</h3>
            <p className="text-ink-muted text-[13px]">{order.notes}</p>
          </div>
        ) : null}
        {delivery?.notes ? (
          <div>
            <h3 className="text-ink mb-1 text-sm font-semibold">Delivery notes</h3>
            <p className="text-ink-muted text-[13px]">{delivery.notes}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

const WARN_ROW = 'border-warn-500/40 bg-warn-50/70 dark:bg-warn-500/8'

function price(line: { unitPrice?: number; unit: string }): string | null {
  return line.unitPrice === undefined ? null : `${formatMoney(line.unitPrice)}/${perUnit(line.unit)}`
}

/** An ordered line, with what happened to it once the order was checked in. */
function OrderLineRow({ line, delivery }: { line: SupplierOrderLine; delivery: Delivery | undefined }) {
  const received = delivery?.lines.find((entry) => entry.orderLineId === line.id)
  const missing = delivery?.notReceived?.find((entry) => entry.id === line.id)
  const flagged = Boolean(missing) || (received !== undefined && isDiscrepancy(received))
  const amount = line.unitPrice === undefined ? '—' : formatMoney(line.quantity * line.unitPrice)
  const note = missing?.note ?? received?.note

  let quantity = formatQuantity(line.quantity, line.unit)
  if (missing) quantity = `Ordered ${quantity}`
  else if (received && received.quantity !== line.quantity) {
    quantity = `Ordered ${quantity} · received ${formatQuantity(received.quantity, received.unit)}`
  }

  return (
    <li className={cn('rounded-lg border px-3.5 py-2.5', flagged ? WARN_ROW : 'border-line')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">{line.product}</p>
          <p className="text-ink-muted text-xs">
            {[titleCase(line.category), quantity, price(line)].filter(Boolean).join(' · ')}
          </p>
          {note ? <p className="text-warn-700 dark:text-warn-500 mt-1 text-xs">Note: {note}</p> : null}
          {received && !received.accepted ? (
            <p className="text-fail-600 dark:text-fail-500 mt-1 text-xs">
              Rejected: {received.rejectionReason ?? 'no reason recorded'}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular text-ink text-sm font-semibold">{amount}</span>
          {missing ? <Badge tone="warn">Not received</Badge> : null}
          {received && isShort(received) ? <Badge tone="warn">Short</Badge> : null}
          {received && !received.accepted ? <Badge tone="fail">Rejected</Badge> : null}
        </div>
      </div>
    </li>
  )
}

function ExtraRow({ line }: { line: DeliveryLine }) {
  return (
    <li className="border-line rounded-lg border border-dashed px-3.5 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">{line.product}</p>
          <p className="text-ink-muted text-xs">
            {[titleCase(line.category), formatQuantity(line.quantity, line.unit), price(line)].filter(Boolean).join(' · ')}
          </p>
          {line.note ? <p className="text-warn-700 dark:text-warn-500 mt-1 text-xs">Note: {line.note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular text-ink text-sm font-semibold">
            {line.unitPrice === undefined ? '—' : formatMoney(line.quantity * line.unitPrice)}
          </span>
          <Badge tone="info">Extra</Badge>
        </div>
      </div>
    </li>
  )
}
