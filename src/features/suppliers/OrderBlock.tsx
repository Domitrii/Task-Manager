import { Pencil } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { SupplierOrder } from '@/data/types'
import { orderState, orderTotal } from '@/lib/compliance'
import { formatMoney, formatQuantity, formatWeekdayDate, perUnit } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { OrderStatusBadge } from '@/components/shared/StatusBadge'
import { OrderDates } from './OrderDates'

/**
 * An upcoming order laid out in full, as the manager left it: who it's from,
 * when it's coming, every item with its price, the total and any notes.
 */
export function OrderBlock({
  order,
  now,
  onEdit,
  onCancel,
}: {
  order: SupplierOrder
  now: Date
  /** Managers only. */
  onEdit?: () => void
  onCancel?: () => void
}) {
  const { data } = useStore()
  const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)
  const total = orderTotal(order.lines)

  return (
    <Card as="article" className="flex min-w-0 flex-col">
      <div className="border-line flex items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-ink text-[15px] leading-6 font-semibold">{supplier?.name ?? 'Supplier'}</h3>
          <OrderDates order={order} now={now} className="mt-1" />
        </div>
        <OrderStatusBadge state={orderState(order, now)} />
      </div>

      <ul className="divide-line flex-1 divide-y px-4 sm:px-5" aria-label="Items">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-ink text-[13px] font-medium">{line.product}</p>
              <p className="text-ink-muted text-xs">
                {formatQuantity(line.quantity, line.unit)}
                {line.unitPrice !== undefined
                  ? ` × ${formatMoney(line.unitPrice)}/${perUnit(line.unit)}`
                  : ' · no price yet'}
              </p>
            </div>
            <span className="tabular text-ink shrink-0 text-[13px] font-medium">
              {line.unitPrice !== undefined ? formatMoney(line.quantity * line.unitPrice) : '—'}
            </span>
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="border-line text-ink-muted border-t px-4 py-2.5 text-[13px] sm:px-5">
          <span className="text-ink font-medium">Notes: </span>
          {order.notes}
        </p>
      ) : null}

      <div className="border-line bg-surface-muted/60 rounded-b-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold">
            Total <span className="tabular">{formatMoney(total.total)}</span>
            {total.unpriced > 0 ? (
              <span className="text-ink-muted font-normal"> + {total.unpriced} unpriced</span>
            ) : null}
          </p>
          <p className="text-ink-subtle text-xs">
            {order.lines.length} item{order.lines.length === 1 ? '' : 's'} · ordered by {staffName(data, order.createdBy)},{' '}
            {formatWeekdayDate(order.createdAt)}
          </p>
        </div>
        {onEdit || onCancel ? (
          <div className="flex gap-2">
            {onCancel ? (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel order
              </Button>
            ) : null}
            {onEdit ? (
              <Button size="sm" onClick={onEdit}>
                <Pencil className="size-4" />
                Edit order
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
