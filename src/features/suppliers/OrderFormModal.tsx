import { useId, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { productKey, selectLastPrices, type RememberedPrice } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ID, Supplier, SupplierOrder, SupplierOrderLine } from '@/data/types'
import { orderTotal, toISODate } from '@/lib/compliance'
import { formatMoney, formatWeekdayDate, perUnit } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { createId } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { CategorySelect, PriceInput, QuantityInput } from '@/features/deliveries/LineFields'

/** A line as it's being edited. */
interface FormLine extends SupplierOrderLine {
  /**
   * The price was typed in, or came with the order being edited or repeated.
   * Until then, naming a product this supplier has sold before fills in its last price.
   */
  priceSet: boolean
}

function emptyLine(supplier: Supplier | undefined): FormLine {
  return {
    id: createId('ol'),
    product: '',
    category: supplier?.categories[0] ?? 'chilled',
    quantity: 1,
    unit: 'kg',
    priceSet: false,
  }
}

function toOrderLine(line: FormLine): SupplierOrderLine {
  return {
    id: line.id,
    product: line.product.trim(),
    category: line.category,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
  }
}

/**
 * A new order, a change to an open one, or a repeat of a past one: the same
 * items, quantities, units and prices as a new order, leaving the past one as
 * it was. Dates start empty on a repeat, so it's a draft until the supplier
 * gives them.
 */
export function OrderFormModal({
  supplierId: initialSupplierId,
  existing,
  repeatOf,
  onClose,
}: {
  /** Who it's from, when opened from a supplier. Otherwise it's picked in the form. */
  supplierId?: ID
  existing?: SupplierOrder
  repeatOf?: SupplierOrder
  onClose: () => void
}) {
  const now = useNow()
  const { data, activeStaffId, saveOrder } = useStore()
  const toast = useToast()
  const listId = useId()
  const today = toISODate(now)

  const [supplierId, setSupplierId] = useState(
    existing?.supplierId ?? repeatOf?.supplierId ?? initialSupplierId ?? '',
  )
  const supplier = data.suppliers.find((entry) => entry.id === supplierId)
  // Active suppliers to choose from, plus this order's own if it has since been made inactive.
  const choices = data.suppliers.filter((entry) => entry.active || entry.id === supplierId)

  const prices = useMemo(
    () => (supplierId ? selectLastPrices(data, supplierId, existing?.id) : new Map<string, RememberedPrice>()),
    [data, supplierId, existing?.id],
  )
  const suggestions = useMemo(
    () => [...prices.values()].map((entry) => entry.product).sort((a, b) => a.localeCompare(b)),
    [prices],
  )

  // Mounted only while open, so these seed once from the order being edited or repeated.
  const [deliveryDate, setDeliveryDate] = useState(existing?.deliveryDate ?? '')
  const [noDeadline, setNoDeadline] = useState(existing ? !existing.orderBy : true)
  const [orderBy, setOrderBy] = useState(existing?.orderBy ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [lines, setLines] = useState<FormLine[]>(() => {
    const source = existing?.lines ?? repeatOf?.lines
    if (!source) return [emptyLine(supplier)]
    return source.map((line) => ({
      ...line,
      id: existing ? line.id : createId('ol'),
      priceSet: line.unitPrice !== undefined,
    }))
  })
  const [submitted, setSubmitted] = useState(false)
  // The item just added, whose product field takes the focus, scrolling it into view.
  const [addedId, setAddedId] = useState<ID | null>(null)

  const total = orderTotal(lines.filter((line) => line.quantity > 0))
  const errors = {
    product: lines.some((line) => line.product.trim() === ''),
    quantity: lines.some((line) => !(line.quantity > 0)),
    price: lines.some((line) => line.unitPrice !== undefined && !(line.unitPrice >= 0)),
    // An order already overdue keeps its date until it's moved.
    deliveryDate:
      deliveryDate !== '' && deliveryDate < today && deliveryDate !== existing?.deliveryDate
        ? 'Pick today or a later day.'
        : undefined,
    orderBy: noDeadline
      ? undefined
      : orderBy === ''
        ? 'Pick a date, or tick No deadline.'
        : deliveryDate !== '' && orderBy > deliveryDate
          ? 'This has to be on or before the delivery date.'
          : undefined,
  }
  const valid =
    supplierId !== '' &&
    lines.length > 0 &&
    !errors.product && !errors.quantity && !errors.price && !errors.deliveryDate && !errors.orderBy

  function addLine() {
    const line = emptyLine(supplier)
    setLines((current) => [...current, line])
    setAddedId(line.id)
  }

  /** Another supplier's last prices for anything not priced by hand yet. */
  function changeSupplier(id: ID) {
    setSupplierId(id)
    const remembered = id ? selectLastPrices(data, id, existing?.id) : new Map<string, RememberedPrice>()
    setLines((current) =>
      current.map((line) => {
        const last = line.priceSet ? undefined : remembered.get(productKey(line.product))
        return last ? { ...line, unitPrice: last.unitPrice, unit: last.unit, category: last.category } : line
      }),
    )
  }

  function updateLine(id: ID, changes: Partial<FormLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line
        const next = { ...line, ...changes }
        if ('unitPrice' in changes) next.priceSet = changes.unitPrice !== undefined
        if (changes.product !== undefined && !next.priceSet) {
          const remembered = prices.get(productKey(changes.product))
          if (remembered) {
            next.unitPrice = remembered.unitPrice
            next.unit = remembered.unit
            next.category = remembered.category
          }
        }
        return next
      }),
    )
  }

  function handleSave() {
    setSubmitted(true)
    if (!valid) return
    const order: SupplierOrder = {
      ...existing,
      id: existing?.id ?? createId('so'),
      supplierId,
      status: 'open',
      lines: lines.map(toOrderLine),
      deliveryDate: deliveryDate || undefined,
      orderBy: noDeadline ? undefined : orderBy || undefined,
      notes: notes.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      createdBy: existing?.createdBy ?? activeStaffId,
      repeatOf: existing ? existing.repeatOf : repeatOf?.id,
    }
    saveOrder(order)
    toast.success(
      order.deliveryDate ? (existing ? 'Order updated' : 'Order saved') : 'Draft saved',
      `${supplier?.name ?? 'Supplier'} · ${order.deliveryDate ? `delivery ${formatWeekdayDate(order.deliveryDate)}` : 'dates not set yet'}`,
    )
    onClose()
  }

  const title = existing ? 'Edit order' : repeatOf ? 'Repeat order' : 'New order'
  const description = repeatOf
    ? 'Same items, quantities and prices as before. Set the dates once the supplier gives them.'
    : existing
      ? undefined
      : 'Who it’s from, when it’s coming and what’s on it. On its delivery day it moves to Deliveries to be checked in.'

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {deliveryDate ? (existing ? 'Save changes' : 'Save order') : 'Save draft'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Supplier"
            required
            htmlFor="order-supplier"
            error={submitted && supplierId === '' ? 'Choose who it’s from.' : undefined}
            className="sm:col-span-2"
          >
            <Select
              id="order-supplier"
              value={supplierId}
              invalid={submitted && supplierId === ''}
              onChange={(event) => changeSupplier(event.target.value)}
            >
              <option value="">Choose a supplier…</option>
              {choices.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Delivery date"
            htmlFor="order-delivery"
            hint="When the supplier says it will arrive. Leave it empty to keep this a draft."
            error={submitted ? errors.deliveryDate : undefined}
          >
            <TextInput
              id="order-delivery"
              type="date"
              value={deliveryDate}
              min={today}
              invalid={submitted && Boolean(errors.deliveryDate)}
              onChange={(event) => setDeliveryDate(event.target.value)}
            />
          </Field>

          <Field
            label="Order by"
            htmlFor="order-by"
            hint="The last day to add or change items with the supplier."
            error={submitted ? errors.orderBy : undefined}
          >
            <TextInput
              id="order-by"
              type="date"
              value={noDeadline ? '' : orderBy}
              max={deliveryDate || undefined}
              disabled={noDeadline}
              invalid={submitted && Boolean(errors.orderBy)}
              onChange={(event) => setOrderBy(event.target.value)}
            />
            <Checkbox
              label="No deadline"
              checked={noDeadline}
              className="mt-1"
              onChange={(event) => setNoDeadline(event.target.checked)}
            />
          </Field>
        </div>

        <div>
          <h3 className="text-ink mb-2 text-sm font-semibold">
            Items
            <span className="text-ink-muted ml-1.5 font-normal">({lines.length})</span>
          </h3>

          <datalist id={listId}>
            {suggestions.map((product) => (
              <option key={product} value={product} />
            ))}
          </datalist>

          <ul className="space-y-3">
            {lines.map((line, index) => {
              const remembered = prices.get(productKey(line.product))
              const lineTotal =
                line.unitPrice !== undefined && line.quantity > 0 ? formatMoney(line.quantity * line.unitPrice) : '—'
              return (
                <li key={line.id} className="border-line bg-surface rounded-lg border p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-ink-muted text-xs font-semibold tracking-wide uppercase">Item {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-ink text-sm font-semibold">{lineTotal}</span>
                      {lines.length > 1 ? (
                        <IconButton
                          label={`Remove ${line.product.trim() || `item ${index + 1}`}`}
                          size="sm"
                          onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-6 lg:grid-cols-12">
                    <Field label="Product" required className="sm:col-span-6 lg:col-span-5">
                      <TextInput
                        list={listId}
                        value={line.product}
                        placeholder="e.g. Chicken breast, skin-on"
                        autoComplete="off"
                        autoFocus={line.id === addedId}
                        invalid={submitted && line.product.trim() === ''}
                        onChange={(event) => updateLine(line.id, { product: event.target.value })}
                      />
                    </Field>
                    <Field label="Category" className="sm:col-span-2 lg:col-span-2">
                      <CategorySelect value={line.category} onChange={(category) => updateLine(line.id, { category })} />
                    </Field>
                    <Field label="Quantity" className="sm:col-span-2 lg:col-span-3">
                      <QuantityInput
                        quantity={line.quantity}
                        unit={line.unit}
                        invalid={submitted && !(line.quantity > 0)}
                        onChange={(changes) => updateLine(line.id, changes)}
                      />
                    </Field>
                    <Field
                      label="Price per unit"
                      hint={remembered ? `Last time ${formatMoney(remembered.unitPrice)}/${perUnit(remembered.unit)}` : undefined}
                      className="sm:col-span-2 lg:col-span-2"
                    >
                      <PriceInput
                        value={line.unitPrice}
                        label={`Price per ${perUnit(line.unit)} for ${line.product.trim() || `item ${index + 1}`}`}
                        invalid={submitted && line.unitPrice !== undefined && !(line.unitPrice >= 0)}
                        onChange={(unitPrice) => updateLine(line.id, { unitPrice })}
                      />
                    </Field>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* After the last item, so a long order never means scrolling back up to add one. */}
          <Button block className="mt-3 border-dashed" onClick={addLine}>
            <Plus className="size-4" />
            Add item
          </Button>

          <div className="border-line mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3">
            <span className="text-ink-muted text-sm">
              Order total
              {total.unpriced > 0 ? (
                <span className="text-ink-subtle">
                  {' '}
                  · {total.unpriced} item{total.unpriced === 1 ? '' : 's'} without a price
                </span>
              ) : null}
            </span>
            <span className="tabular text-ink text-lg font-bold">{formatMoney(total.total)}</span>
          </div>
        </div>

        <Field label="Notes" hint="Optional: anything the supplier said" htmlFor="order-notes">
          <Textarea
            id="order-notes"
            value={notes}
            placeholder="e.g. Ray will call if the sirloin is short."
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
