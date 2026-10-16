import { useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowUpToLine, Check, CheckCheck, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '@/data/store'
import type { Delivery, DeliveryLine, ID, SupplierOrder, SupplierOrderLine } from '@/data/types'
import {
  deliveryLineConcern,
  deliveryTempLimit,
  deriveDeliveryStatus,
  isDiscrepancy,
} from '@/lib/compliance'
import { formatMoney, formatQuantity, formatWeekdayDate, perUnit } from '@/lib/format'
import { cn, createId } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { orderSummary } from '@/features/suppliers/orders'
import {
  AcceptanceRow,
  CategorySelect,
  PackagingAndDateFields,
  PriceInput,
  QuantityInput,
  TemperatureField,
} from './LineFields'
import { changeLine, isProbed } from './lines'

type Answer = 'received' | 'missing'

/** One ordered item on the checklist. */
interface CheckItem {
  /** The delivery line it becomes if it arrived. */
  line: DeliveryLine
  answer?: Answer
  /** An extra moved onto the order list: it's here, and it joins the order when the check-in is done. */
  moved?: boolean
}

const RECEIVED_NOTES = ['Damaged', 'Wrong item', 'Short', 'Poor quality']
const MISSING_NOTES = ['Out of stock', 'Coming later', 'Substituted']

const WARN_ROW = 'border-warn-500/40 bg-warn-50/60 dark:bg-warn-500/8'
const FAIL_ROW = 'border-fail-500/35 bg-fail-50/50 dark:bg-fail-500/6'

function fromOrderLine(line: SupplierOrderLine): DeliveryLine {
  return {
    id: createId('dl'),
    product: line.product,
    category: line.category,
    quantity: line.quantity,
    unit: line.unit,
    // Probed on the day: nothing is filled in for anyone.
    temperature: null,
    packaging: 'good',
    accepted: true,
    orderLineId: line.id,
    orderedQuantity: line.quantity,
    unitPrice: line.unitPrice,
  }
}

function emptyExtra(): DeliveryLine {
  return {
    id: createId('dl'),
    product: '',
    category: 'chilled',
    quantity: 1,
    unit: 'kg',
    temperature: null,
    packaging: 'good',
    accepted: true,
  }
}

function tidy(line: DeliveryLine): DeliveryLine {
  return { ...line, product: line.product.trim(), note: line.note?.trim() || undefined }
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/**
 * Checking in an order as it arrives: a checklist of what was ordered, one tap
 * per item when all is well. Opening an item records what actually came and
 * the food-safety checks; chilled and frozen items need a temperature. Extras
 * the driver brought go in their own list. Completing it records a normal
 * delivery against the order, in the name of whoever checked it in.
 */
export function CheckInModal({ order, onClose }: { order: SupplierOrder; onClose: () => void }) {
  const { data, activeStaff, checkInOrder } = useStore()
  const toast = useToast()
  const settings = data.settings
  const supplier = data.suppliers.find((entry) => entry.id === order.supplierId)

  const [items, setItems] = useState<CheckItem[]>(() => order.lines.map((line) => ({ line: fromOrderLine(line) })))
  const [extras, setExtras] = useState<DeliveryLine[]>([])
  const [expanded, setExpanded] = useState<Set<ID>>(() => new Set())
  const [driverName, setDriverName] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [vehicleTempOk, setVehicleTempOk] = useState(true)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const received = items.filter((item) => item.answer === 'received').map((item) => item.line)
  const missing = items.filter((item) => item.answer === 'missing')
  const arrived = [...received, ...extras]
  const unanswered = items.filter((item) => !item.answer).length
  const rejected = arrived.filter((line) => !line.accepted).length
  const discrepancies = missing.length + received.filter(isDiscrepancy).length

  const needsTemp = (line: DeliveryLine) => isProbed(line.category, settings) && line.temperature === null
  const lineProblem = (line: DeliveryLine) =>
    needsTemp(line) || !(line.quantity > 0) || (!line.accepted && !line.rejectionReason)
  const todo = [
    unanswered > 0 ? `${plural(unanswered, 'item')} not checked yet` : null,
    arrived.filter(needsTemp).length > 0 ? `${plural(arrived.filter(needsTemp).length, 'temperature')} to take` : null,
    arrived.filter((line) => !(line.quantity > 0)).length > 0 ? 'a quantity received is missing' : null,
    arrived.filter((line) => !line.accepted && !line.rejectionReason).length > 0
      ? `${plural(arrived.filter((line) => !line.accepted && !line.rejectionReason).length, 'rejection')} without a reason`
      : null,
    extras.some((line) => line.product.trim() === '') ? 'an extra without a name' : null,
    extras.some((line) => line.unitPrice !== undefined && !(line.unitPrice >= 0)) ? 'an extra with a wrong price' : null,
    unanswered === 0 && arrived.length === 0
      ? 'nothing arrived: move the delivery date or cancel the order instead'
      : null,
  ].filter((entry): entry is string => entry !== null)

  function updateItem(id: ID, changes: Partial<DeliveryLine>) {
    setItems((current) =>
      current.map((item) => {
        if (item.line.id !== id) return item
        const line = changeLine(item.line, changes, settings, null)
        // Moved from the extras, it was ordered in whatever amount came.
        if (item.moved && changes.quantity !== undefined) line.orderedQuantity = changes.quantity
        return { ...item, line }
      }),
    )
  }

  function answer(id: ID, value: Answer) {
    setItems((current) => current.map((item) => (item.line.id === id ? { ...item, answer: value } : item)))
  }

  function markAllReceived() {
    setItems((current) => current.map((item) => (item.answer ? item : { ...item, answer: 'received' })))
  }

  function toggle(id: ID) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateExtra(id: ID, changes: Partial<DeliveryLine>) {
    setExtras((current) => current.map((line) => (line.id === id ? changeLine(line, changes, settings, null) : line)))
  }

  function moveToOrder(id: ID) {
    const extra = extras.find((line) => line.id === id)
    if (!extra) return
    setExtras((current) => current.filter((line) => line.id !== id))
    setItems((current) => [
      ...current,
      { line: { ...extra, orderLineId: createId('ol'), orderedQuantity: extra.quantity }, answer: 'received', moved: true },
    ])
  }

  function moveBackToExtras(id: ID) {
    const item = items.find((entry) => entry.line.id === id)
    if (!item) return
    setItems((current) => current.filter((entry) => entry.line.id !== id))
    setExtras((current) => [...current, { ...item.line, orderLineId: undefined, orderedQuantity: undefined }])
  }

  function handleComplete() {
    setSubmitted(true)
    if (todo.length > 0) {
      // Open whatever needs a field that's tucked away, so it can be seen.
      setExpanded(
        (current) =>
          new Set([
            ...current,
            ...items.filter((item) => item.answer === 'received' && lineProblem(item.line)).map((item) => item.line.id),
          ]),
      )
      return
    }

    const delivery: Delivery = {
      id: createId('dv'),
      supplierId: order.supplierId,
      receivedAt: new Date().toISOString(),
      checkedBy: activeStaff.id,
      status: deriveDeliveryStatus(arrived),
      lines: [...received.map(tidy), ...extras.map((line) => ({ ...tidy(line), extra: true }))],
      notReceived:
        missing.length > 0
          ? missing.map(({ line }) => ({
              id: line.orderLineId ?? createId('ol'),
              product: line.product,
              category: line.category,
              quantity: line.orderedQuantity ?? line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              note: line.note?.trim() || undefined,
            }))
          : undefined,
      deliveryNote: deliveryNote.trim() || undefined,
      driverName: driverName.trim() || undefined,
      vehicleTempOk,
      notes: notes.trim() || undefined,
    }
    const addToOrder: SupplierOrderLine[] = items
      .filter((item) => item.moved)
      .map(({ line }) => ({
        id: line.orderLineId ?? createId('ol'),
        product: line.product.trim(),
        category: line.category,
        quantity: line.orderedQuantity ?? line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
      }))

    checkInOrder({ orderId: order.id, delivery, addToOrder })

    if (delivery.status !== 'accepted') {
      toast.error(
        'Checked in with rejections',
        `${rejected} of ${arrived.length} lines rejected — a food safety issue has been raised.`,
      )
    } else {
      toast.success(
        'Order checked in',
        `${supplier?.name ?? 'Supplier'} · ${discrepancies > 0 ? plural(discrepancies, 'discrepancy', 'discrepancies') + ' noted' : 'everything as ordered'}`,
      )
    }
    onClose()
  }

  const tone = rejected > 0 ? 'fail' : discrepancies > 0 ? 'warn' : unanswered === 0 && todo.length === 0 ? 'pass' : 'neutral'
  const counts = [
    received.length > 0 ? `${received.length} received` : null,
    missing.length > 0 ? `${missing.length} not received` : null,
    extras.length > 0 ? plural(extras.length, 'extra') : null,
    rejected > 0 ? `${rejected} rejected` : null,
  ].filter(Boolean)

  return (
    <Modal
      open
      onClose={onClose}
      title="Check in delivery"
      description={`${supplier?.name ?? 'Supplier'} · ordered for ${order.deliveryDate ? formatWeekdayDate(order.deliveryDate) : 'no date'}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleComplete}>
            Complete check-in
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-muted text-sm">
            <span className="text-ink font-semibold">
              {items.length - unanswered} of {items.length}
            </span>{' '}
            checked · {orderSummary(order.lines)}
          </p>
          <Button size="sm" onClick={markAllReceived} disabled={unanswered === 0}>
            <CheckCheck className="size-4" />
            {unanswered < items.length ? 'Mark the rest received' : 'Mark all received'}
          </Button>
        </div>

        <ul className="space-y-2" aria-label="Ordered items">
          {items.map((item) => (
            <CheckRow
              key={item.line.id}
              item={item}
              expanded={expanded.has(item.line.id)}
              showErrors={submitted}
              limit={deliveryTempLimit(item.line, settings)}
              concern={item.answer === 'received' ? deliveryLineConcern(item.line, settings) : null}
              onToggle={() => toggle(item.line.id)}
              onAnswer={(value) => answer(item.line.id, value)}
              onChange={(changes) => updateItem(item.line.id, changes)}
              onMoveBack={() => moveBackToExtras(item.line.id)}
            />
          ))}
        </ul>

        <section aria-labelledby="checkin-extras">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 id="checkin-extras" className="text-ink text-sm font-semibold">
                Extras <span className="text-ink-muted font-normal">({extras.length})</span>
              </h3>
              <p className="text-ink-muted text-xs">Anything the supplier brought that wasn’t on the order.</p>
            </div>
            <Button size="sm" onClick={() => setExtras((current) => [...current, emptyExtra()])}>
              <Plus className="size-4" />
              Add extra item
            </Button>
          </div>
          {extras.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {extras.map((line, index) => (
                <ExtraEditor
                  key={line.id}
                  line={line}
                  index={index}
                  showErrors={submitted}
                  limit={deliveryTempLimit(line, settings)}
                  onChange={(changes) => updateExtra(line.id, changes)}
                  onMove={() => moveToOrder(line.id)}
                  onRemove={() => setExtras((current) => current.filter((entry) => entry.id !== line.id))}
                />
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="checkin-details" className="space-y-3">
          <h3 id="checkin-details" className="text-ink text-sm font-semibold">
            Delivery
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Driver" hint="Optional" htmlFor="checkin-driver">
              <TextInput
                id="checkin-driver"
                value={driverName}
                placeholder="Name on the delivery note"
                onChange={(event) => setDriverName(event.target.value)}
              />
            </Field>
            <Field label="Delivery note ref." hint="Optional" htmlFor="checkin-note-ref">
              <TextInput
                id="checkin-note-ref"
                value={deliveryNote}
                placeholder="DN-48219"
                onChange={(event) => setDeliveryNote(event.target.value)}
              />
            </Field>
            <Checkbox
              className="sm:col-span-2"
              label="Vehicle at correct temperature on arrival"
              description="Chilled and frozen compartments running as expected"
              checked={vehicleTempOk}
              onChange={(event) => setVehicleTempOk(event.target.checked)}
            />
            <Field label="Notes" hint="Optional" htmlFor="checkin-notes" className="sm:col-span-2">
              <Textarea
                id="checkin-notes"
                value={notes}
                placeholder="e.g. Driver waited while the chilled lines were probed."
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
        </section>

        <div
          className={cn(
            'rounded-lg border px-3.5 py-2.5 text-[13px]',
            tone === 'fail' && 'border-fail-500/30 bg-fail-50 text-fail-700 dark:bg-fail-500/10 dark:text-fail-500',
            tone === 'warn' && 'border-warn-500/30 bg-warn-50 text-warn-700 dark:bg-warn-500/10 dark:text-warn-500',
            tone === 'pass' && 'border-pass-500/30 bg-pass-50 text-pass-700 dark:bg-pass-500/10 dark:text-pass-500',
            tone === 'neutral' && 'border-line bg-surface-muted text-ink-muted',
          )}
        >
          <p className="flex items-center gap-2">
            {tone === 'fail' || tone === 'warn' ? <AlertTriangle className="size-4 shrink-0" /> : null}
            <span>
              {counts.length > 0 ? counts.join(' · ') : 'Nothing checked yet'}
              {discrepancies > 0 ? ` · ${plural(discrepancies, 'discrepancy', 'discrepancies')}` : ''}. Checked in by{' '}
              {activeStaff.name}.
            </span>
          </p>
          {submitted && todo.length > 0 ? (
            <p className="text-fail-700 dark:text-fail-500 mt-1 font-medium">Still to do: {todo.join('; ')}.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

function AnswerButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: 'pass' | 'warn'
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition-colors sm:flex-none',
        !active && 'border-line-default bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink',
        active && tone === 'pass' && 'border-pass-500/50 bg-pass-50 text-pass-700 dark:bg-pass-500/12 dark:text-pass-500',
        active && tone === 'warn' && 'border-warn-500/50 bg-warn-50 text-warn-700 dark:bg-warn-500/12 dark:text-warn-500',
      )}
    >
      {children}
    </button>
  )
}

function NoteField({
  value,
  chips,
  label,
  onChange,
}: {
  value: string | undefined
  chips: string[]
  label: string
  onChange: (note: string | undefined) => void
}) {
  return (
    <Field label={label} hint="Optional. Anything here marks the item as a discrepancy.">
      <TextInput
        value={value ?? ''}
        maxLength={140}
        placeholder="e.g. 2 trays short"
        onChange={(event) => onChange(event.target.value || undefined)}
      />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className="border-line-default text-ink-muted hover:bg-surface-muted hover:text-ink rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
            onClick={() => onChange(value ? `${value}, ${chip.toLowerCase()}` : chip)}
          >
            {chip}
          </button>
        ))}
      </div>
    </Field>
  )
}

function CheckRow({
  item,
  expanded,
  showErrors,
  limit,
  concern,
  onToggle,
  onAnswer,
  onChange,
  onMoveBack,
}: {
  item: CheckItem
  expanded: boolean
  showErrors: boolean
  limit: number | null
  concern: string | null
  onToggle: () => void
  onAnswer: (value: Answer) => void
  onChange: (changes: Partial<DeliveryLine>) => void
  onMoveBack: () => void
}) {
  const { line, answer } = item
  const received = answer === 'received'
  const flagged = answer === 'missing' || (received && isDiscrepancy(line))
  const rejected = received && !line.accepted
  const ordered = formatQuantity(line.orderedQuantity ?? line.quantity, line.unit)
  const differs = received && line.orderedQuantity !== undefined && line.quantity !== line.orderedQuantity

  return (
    <li
      className={cn(
        'rounded-lg border',
        rejected ? FAIL_ROW : flagged ? WARN_ROW : 'border-line bg-surface',
        showErrors && !answer && 'border-fail-500/60',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={!answer}
          aria-expanded={answer ? expanded : undefined}
          aria-label={answer ? `${expanded ? 'Hide' : 'Show'} details for ${line.product}` : undefined}
          className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-default"
        >
          <ChevronRight
            className={cn(
              'text-ink-subtle mt-0.5 size-4 shrink-0 transition-transform',
              expanded && answer && 'rotate-90',
              !answer && 'invisible',
            )}
          />
          <span className="min-w-0">
            <span className="text-ink block text-sm font-medium">{line.product}</span>
            <span className="text-ink-muted block text-xs">
              {item.moved ? 'Added today' : `${ordered} ordered`}
              {line.unitPrice !== undefined ? ` · ${formatMoney(line.unitPrice)}/${perUnit(line.unit)}` : ''}
              {differs ? ` · ${formatQuantity(line.quantity, line.unit)} received` : ''}
            </span>
            {line.note ? (
              <span className="text-warn-700 dark:text-warn-500 mt-0.5 block text-xs">Note: {line.note}</span>
            ) : null}
          </span>
        </button>
        {item.moved ? (
          <Badge tone="info">Extra, now on the order</Badge>
        ) : (
          <div className="flex w-full gap-1.5 sm:w-auto" role="group" aria-label={`Did ${line.product} arrive?`}>
            <AnswerButton active={answer === 'received'} tone="pass" onClick={() => onAnswer('received')}>
              <Check className="size-4" />
              Received
            </AnswerButton>
            <AnswerButton active={answer === 'missing'} tone="warn" onClick={() => onAnswer('missing')}>
              <X className="size-4" />
              Not received
            </AnswerButton>
          </div>
        )}
      </div>

      {received && limit !== null ? (
        <div className="border-line/70 flex flex-wrap items-end gap-3 border-t px-3 py-3">
          <div className="w-full sm:w-48">
            <TemperatureField line={line} limit={limit} required showErrors={showErrors} onChange={onChange} />
          </div>
          {concern ? (
            <Badge tone="warn" icon={<AlertTriangle className="size-3.5" />} className="mb-2.5">
              {concern}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {expanded && answer ? (
        <div className="border-line/70 space-y-3 border-t px-3 py-3">
          {received ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Quantity received"
                  hint={line.orderedQuantity !== undefined ? `Ordered ${ordered}` : undefined}
                  className="sm:col-span-2 lg:col-span-2"
                >
                  <QuantityInput
                    quantity={line.quantity}
                    unit={line.unit}
                    label={`Quantity of ${line.product} received`}
                    invalid={showErrors && !(line.quantity > 0)}
                    onChange={onChange}
                  />
                </Field>
                <PackagingAndDateFields line={line} onChange={onChange} />
              </div>
              <NoteField
                label="Note"
                value={line.note}
                chips={RECEIVED_NOTES}
                onChange={(note) => onChange({ note })}
              />
              <AcceptanceRow line={line} showErrors={showErrors} onChange={onChange} />
              {item.moved ? (
                <Button size="sm" variant="ghost" className="-ml-2" onClick={onMoveBack}>
                  Move back to extras
                </Button>
              ) : null}
            </>
          ) : (
            <NoteField
              label="Why it didn’t come"
              value={line.note}
              chips={MISSING_NOTES}
              onChange={(note) => onChange({ note })}
            />
          )}
        </div>
      ) : null}
    </li>
  )
}

function ExtraEditor({
  line,
  index,
  limit,
  showErrors,
  onChange,
  onMove,
  onRemove,
}: {
  line: DeliveryLine
  index: number
  limit: number | null
  showErrors: boolean
  onChange: (changes: Partial<DeliveryLine>) => void
  onMove: () => void
  onRemove: () => void
}) {
  const name = line.product.trim() || `extra ${index + 1}`
  return (
    <li
      className={cn(
        'rounded-lg border border-dashed p-3.5',
        line.accepted ? 'border-line-strong bg-surface' : FAIL_ROW,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-ink-muted text-xs font-semibold tracking-wide uppercase">Extra {index + 1}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onMove} disabled={line.product.trim() === ''}>
            <ArrowUpToLine className="size-4" />
            Move to order list
          </Button>
          <IconButton label={`Remove ${name}`} size="sm" onClick={onRemove}>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Product" required className="sm:col-span-2">
          <TextInput
            value={line.product}
            placeholder="e.g. Lamb shoulder"
            invalid={showErrors && line.product.trim() === ''}
            onChange={(event) => onChange({ product: event.target.value })}
          />
        </Field>
        <Field label="Category">
          <CategorySelect value={line.category} onChange={(category) => onChange({ category })} />
        </Field>
        <Field label="Quantity">
          <QuantityInput
            quantity={line.quantity}
            unit={line.unit}
            label={`Quantity of ${name}`}
            invalid={showErrors && !(line.quantity > 0)}
            onChange={onChange}
          />
        </Field>
        <Field label="Price per unit" hint="Optional">
          <PriceInput
            value={line.unitPrice}
            label={`Price per ${perUnit(line.unit)} for ${name}`}
            invalid={showErrors && line.unitPrice !== undefined && !(line.unitPrice >= 0)}
            onChange={(unitPrice) => onChange({ unitPrice })}
          />
        </Field>
        {limit !== null ? (
          <TemperatureField line={line} limit={limit} required showErrors={showErrors} onChange={onChange} />
        ) : null}
        <PackagingAndDateFields line={line} onChange={onChange} />
      </div>

      <div className="border-line mt-3 border-t pt-3">
        <AcceptanceRow line={line} showErrors={showErrors} onChange={onChange} />
      </div>
    </li>
  )
}
