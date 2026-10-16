import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, ClipboardList, FileText, PackageX, Repeat, Thermometer, Truck, User } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { Delivery } from '@/data/types'
import { deliveryTempLimit, discrepancyCount, isDiscrepancy, isShort } from '@/lib/compliance'
import { formatDate, formatDateTime, formatMoney, formatQuantity, formatTemp, formatWeekdayDate, perUnit } from '@/lib/format'
import { cn, titleCase } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DeliveryStatusBadge, DiscrepancyBadge } from '@/components/shared/StatusBadge'

export function DeliveryDetailModal({
  delivery,
  onClose,
  onEdit,
  onRepeat,
}: {
  delivery: Delivery | undefined
  onClose: () => void
  onEdit: (delivery: Delivery) => void
  onRepeat: (delivery: Delivery) => void
}) {
  const { data } = useStore()
  if (!delivery) return null

  const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
  const rejected = delivery.lines.filter((line) => !line.accepted)
  const order = delivery.orderId ? data.supplierOrders.find((entry) => entry.id === delivery.orderId) : undefined
  const missing = delivery.notReceived ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier?.name ?? 'Delivery'}
      description={formatDateTime(delivery.receivedAt)}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onRepeat(delivery)} className="gap-1.5">
            <Repeat className="size-4" />
            Repeat delivery
          </Button>
          <Button variant="primary" onClick={() => onEdit(delivery)}>
            Edit delivery
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <DeliveryStatusBadge status={delivery.status} />
          <DiscrepancyBadge count={discrepancyCount(delivery)} />
          <Badge tone="neutral">
            {delivery.lines.length} line{delivery.lines.length === 1 ? '' : 's'}
          </Badge>
          {order ? (
            <Link
              to={`/suppliers?order=${order.id}`}
              className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              <ClipboardList className="size-3.5" />
              {order.deliveryDate ? `Order for ${formatWeekdayDate(order.deliveryDate)}` : 'From an order'}
            </Link>
          ) : null}
          {delivery.vehicleTempOk === false ? (
            <Badge tone="warn" icon={<AlertTriangle className="size-3.5" />}>
              Vehicle temperature not correct
            </Badge>
          ) : null}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <DetailRow icon={<User className="size-4" />} label="Checked by" value={staffName(data, delivery.checkedBy)} />
          <DetailRow icon={<Truck className="size-4" />} label="Driver" value={delivery.driverName ?? '—'} />
          <DetailRow icon={<FileText className="size-4" />} label="Delivery note" value={delivery.deliveryNote ?? '—'} />
          <DetailRow
            icon={<CalendarClock className="size-4" />}
            label="Received"
            value={formatDateTime(delivery.receivedAt)}
          />
        </dl>

        {rejected.length > 0 ? (
          <div className="border-fail-500/30 bg-fail-50 dark:bg-fail-500/8 rounded-lg border px-3.5 py-3">
            <p className="text-fail-700 dark:text-fail-500 flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4" />
              {rejected.length} line{rejected.length === 1 ? '' : 's'} rejected
            </p>
            <ul className="text-ink-muted mt-1.5 space-y-1 text-[13px]">
              {rejected.map((line) => (
                <li key={line.id}>
                  <span className="text-ink font-medium">{line.product}</span> —{' '}
                  {line.rejectionReason ?? 'No reason recorded'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {missing.length > 0 ? (
          <div className="border-warn-500/35 bg-warn-50 dark:bg-warn-500/8 rounded-lg border px-3.5 py-3">
            <p className="text-warn-700 dark:text-warn-500 flex items-center gap-1.5 text-sm font-semibold">
              <PackageX className="size-4" />
              {missing.length} ordered item{missing.length === 1 ? '' : 's'} not received
            </p>
            <ul className="text-ink-muted mt-1.5 space-y-1 text-[13px]">
              {missing.map((line) => (
                <li key={line.id}>
                  <span className="text-ink font-medium">{line.product}</span>,{' '}
                  {formatQuantity(line.quantity, line.unit)}
                  {line.note ? ` — ${line.note}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h3 className="text-ink mb-2 text-sm font-semibold">Products received</h3>
          <div className="space-y-2">
            {delivery.lines.map((line) => {
              const limit = deliveryTempLimit(line, data.settings)
              const tempFailed =
                limit !== null && line.temperature !== null && line.temperature > limit
              return (
                <div
                  key={line.id}
                  className={cn(
                    'rounded-lg border px-3.5 py-3',
                    !line.accepted
                      ? 'border-fail-500/35 bg-fail-50/40 dark:bg-fail-500/6'
                      : isDiscrepancy(line)
                        ? 'border-warn-500/40 bg-warn-50/70 dark:bg-warn-500/8'
                        : 'border-line',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{line.product}</p>
                      <p className="text-ink-muted text-xs">
                        {titleCase(line.category)} ·{' '}
                        {line.orderedQuantity !== undefined && line.orderedQuantity !== line.quantity
                          ? `Ordered ${formatQuantity(line.orderedQuantity, line.unit)} · received ${formatQuantity(line.quantity, line.unit)}`
                          : formatQuantity(line.quantity, line.unit)}
                        {line.unitPrice !== undefined ? ` · ${formatMoney(line.unitPrice)}/${perUnit(line.unit)}` : ''}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1">
                      {line.extra ? <Badge tone="info">Extra</Badge> : null}
                      {isShort(line) ? <Badge tone="warn">Short</Badge> : null}
                      <Badge tone={line.accepted ? 'pass' : 'fail'}>
                        {line.accepted ? 'Accepted' : 'Rejected'}
                      </Badge>
                    </span>
                  </div>

                  <div className="text-ink-muted mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    {line.temperature !== null ? (
                      <span className="flex items-center gap-1">
                        <Thermometer className="size-3.5" />
                        <span
                          className={cn(
                            'tabular font-medium',
                            tempFailed ? 'text-fail-600 dark:text-fail-500' : 'text-ink',
                          )}
                        >
                          {formatTemp(line.temperature)}
                        </span>
                        {limit !== null ? <span>(limit {limit}°C)</span> : null}
                      </span>
                    ) : null}
                    <span>
                      Packaging:{' '}
                      <span className={line.packaging === 'good' ? 'text-ink' : 'text-fail-600 dark:text-fail-500'}>
                        {titleCase(line.packaging)}
                      </span>
                    </span>
                    {line.useBy ? <span>Use by {formatDate(line.useBy)}</span> : null}
                    {line.bestBefore ? <span>Best before {formatDate(line.bestBefore)}</span> : null}
                  </div>

                  {line.note ? (
                    <p className="text-warn-700 dark:text-warn-500 mt-2 text-xs">Note: {line.note}</p>
                  ) : null}
                  {line.rejectionReason ? (
                    <p className="text-fail-600 dark:text-fail-500 mt-2 text-xs">
                      Reason: {line.rejectionReason}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {delivery.notes ? (
          <div>
            <h3 className="text-ink mb-1 text-sm font-semibold">Notes</h3>
            <p className="text-ink-muted text-[13px]">{delivery.notes}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-surface-muted/60 flex items-start gap-2.5 rounded-lg px-3 py-2.5">
      <span className="text-ink-subtle mt-0.5">{icon}</span>
      <div className="min-w-0">
        <dt className="text-ink-muted text-[11px] font-medium">{label}</dt>
        <dd className="text-ink truncate text-[13px] font-medium">{value}</dd>
      </div>
    </div>
  )
}
