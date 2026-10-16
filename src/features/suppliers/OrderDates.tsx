import { CalendarClock, Truck } from 'lucide-react'
import type { SupplierOrder } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { formatWeekdayDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * An open order's two dates as the supplier gave them: when it arrives, and
 * the last day to change it. A draft says its dates aren't set yet.
 */
export function OrderDates({ order, now, className }: { order: SupplierOrder; now: Date; className?: string }) {
  if (!order.deliveryDate) {
    return <span className={cn('text-ink-muted block text-[13px]', className)}>Dates not set yet</span>
  }
  const deadlinePassed = order.orderBy !== undefined && order.orderBy < toISODate(now)
  return (
    // Spans throughout, so it can sit inside a row that is itself a button.
    <span className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]', className)}>
      <span className="text-ink inline-flex items-center gap-1.5 font-medium">
        <Truck className="text-ink-subtle size-3.5 shrink-0" />
        Delivery {formatWeekdayDate(order.deliveryDate)}
      </span>
      <span className="text-ink-muted inline-flex items-center gap-1.5">
        <CalendarClock className="text-ink-subtle size-3.5 shrink-0" />
        {order.orderBy ? (
          <>
            Order by {formatWeekdayDate(order.orderBy)}
            {deadlinePassed ? <span className="text-ink-subtle">(passed)</span> : null}
          </>
        ) : (
          'No deadline'
        )}
      </span>
    </span>
  )
}
