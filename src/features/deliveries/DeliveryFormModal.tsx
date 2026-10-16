import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { AlertTriangle, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { selectOrdersToCheckIn } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { Delivery, DeliveryLine, DeliveryLineCategory, Supplier } from '@/data/types'
import { deliveryLineConcern, deliveryTempLimit, deriveDeliveryStatus } from '@/lib/compliance'
import { cn, createId } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { AcceptanceRow, CategorySelect, PackagingAndDateFields, QuantityInput, TemperatureField } from './LineFields'
import { changeLine } from './lines'
import { SupplierCombobox } from './SupplierCombobox'
import { matchSupplier } from './suppliers'

function toLocalInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function emptyLine(category: DeliveryLineCategory = 'chilled'): DeliveryLine {
  return {
    id: createId('dl'),
    product: '',
    category,
    quantity: 1,
    unit: 'kg',
    temperature: category === 'chilled' || category === 'frozen' || category === 'produce' || category === 'bakery' ? 0 : null,
    packaging: 'good',
    accepted: true,
  }
}

/**
 * The same order as a past delivery: supplier, products, quantities and units.
 * Everything that has to be checked on the day (temperatures, packaging,
 * dates, accept or reject) starts fresh, so a repeat can't skip a check.
 */
function repeatLine(line: DeliveryLine): DeliveryLine {
  return {
    ...emptyLine(line.category),
    product: line.product,
    quantity: line.quantity,
    unit: line.unit,
  }
}

export function DeliveryFormModal({
  open,
  onClose,
  existing,
  repeatOf,
}: {
  open: boolean
  onClose: () => void
  /** Edits this delivery. */
  existing?: Delivery
  /** Records a new delivery pre-filled from this one. */
  repeatOf?: Delivery
}) {
  const { data, activeStaffId, saveDelivery } = useStore()
  const toast = useToast()
  const navigate = useNavigate()

  // Mounted only while open, so the form seeds itself once from `existing`
  // (edit), `repeatOf` (repeat) or sensible defaults (new) and needs no reset effect.
  // The supplier's name as typed: one already on the list, or a new supplier to add.
  const [supplierName, setSupplierName] = useState(() => {
    const seeded = existing
      ? data.suppliers.find((supplier) => supplier.id === existing.supplierId)
      : (data.suppliers.find((supplier) => supplier.id === repeatOf?.supplierId && supplier.active) ??
        data.suppliers.find((supplier) => supplier.active))
    return seeded?.name ?? ''
  })
  const [receivedAt, setReceivedAt] = useState(() =>
    toLocalInputValue(existing ? new Date(existing.receivedAt) : new Date()),
  )
  const [checkedBy, setCheckedBy] = useState(existing?.checkedBy ?? activeStaffId)
  const [deliveryNote, setDeliveryNote] = useState(existing?.deliveryNote ?? '')
  const [driverName, setDriverName] = useState(existing?.driverName ?? repeatOf?.driverName ?? '')
  const [vehicleTempOk, setVehicleTempOk] = useState(existing?.vehicleTempOk ?? true)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [lines, setLines] = useState<DeliveryLine[]>(
    () => existing?.lines.map((line) => ({ ...line })) ?? repeatOf?.lines.map(repeatLine) ?? [emptyLine()],
  )
  const [submitted, setSubmitted] = useState(false)

  const status = useMemo(() => deriveDeliveryStatus(lines), [lines])
  const matchedSupplier = matchSupplier(data.suppliers, supplierName)
  const newSupplierName = matchedSupplier ? '' : supplierName.trim()
  const waitingOrders = useMemo(() => {
    const { due, overdue } = selectOrdersToCheckIn(data, new Date())
    return [...due, ...overdue]
  }, [data])
  const supplierHasOrder = !existing && waitingOrders.some((order) => order.supplierId === matchedSupplier?.id)
  const rejectedCount = lines.filter((line) => !line.accepted).length
  const missingProduct = lines.some((line) => line.product.trim() === '')
  const missingQuantity = lines.some((line) => Number.isNaN(line.quantity))
  const missingReason = lines.some((line) => !line.accepted && !line.rejectionReason)
  const canSave =
    supplierName.trim() !== '' &&
    checkedBy !== '' &&
    lines.length > 0 &&
    !missingProduct &&
    !missingQuantity &&
    !missingReason

  function updateLine(id: string, changes: Partial<DeliveryLine>) {
    setLines((current) => current.map((line) => (line.id === id ? changeLine(line, changes, data.settings) : line)))
  }

  function handleSave() {
    setSubmitted(true)
    if (!canSave) return

    const supplier: Supplier = matchedSupplier ?? {
      id: createId('sup'),
      name: newSupplierName,
      // What came in on this delivery is the best guess at what they supply.
      categories: [...new Set(lines.map((line) => line.category))],
      active: true,
    }
    const delivery: Delivery = {
      // Keeps what this form doesn't show, such as the order it was checked in against.
      ...existing,
      id: existing?.id ?? createId('dv'),
      supplierId: supplier.id,
      receivedAt: new Date(receivedAt).toISOString(),
      checkedBy,
      status,
      lines,
      deliveryNote: deliveryNote.trim() || undefined,
      driverName: driverName.trim() || undefined,
      vehicleTempOk,
      notes: notes.trim() || undefined,
    }

    saveDelivery(delivery, !existing, matchedSupplier ? undefined : supplier)

    if (status === 'accepted') {
      toast.success(
        existing ? 'Delivery updated' : 'Delivery recorded',
        `${supplier.name} · ${lines.length} line${lines.length === 1 ? '' : 's'} accepted.`,
      )
    } else {
      toast.error(
        existing ? 'Delivery updated' : 'Delivery recorded with rejections',
        `${rejectedCount} of ${lines.length} lines rejected — a food safety issue has been raised.`,
      )
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit delivery' : repeatOf ? 'Repeat a delivery' : 'Record a delivery'}
      description={
        repeatOf && !existing
          ? 'Same products and quantities as last time. Probe and check every line again before you record it.'
          : 'Check every line on arrival. Anything out of limits is flagged for rejection.'
      }
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {existing ? 'Save changes' : 'Record delivery'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {supplierHasOrder ? (
          <div className="border-brand-500/35 bg-brand-50 dark:bg-brand-500/10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5">
            <ClipboardList className="text-brand-700 dark:text-brand-300 size-4 shrink-0" />
            <p className="text-ink min-w-0 flex-1 text-[13px]">
              {matchedSupplier?.name} has an order waiting to be checked in. Check it in from the order instead, so
              what came is matched against what was ordered.
            </p>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                onClose()
                navigate('/deliveries')
              }}
            >
              Go to the order
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Supplier"
            required
            htmlFor="delivery-supplier"
            hint={newSupplierName ? 'New supplier — saved to your suppliers with this delivery.' : undefined}
          >
            <SupplierCombobox
              id="delivery-supplier"
              suppliers={data.suppliers}
              value={supplierName}
              invalid={submitted && supplierName.trim() === ''}
              onChange={setSupplierName}
            />
          </Field>

          <Field label="Received" required htmlFor="delivery-at">
            <TextInput
              id="delivery-at"
              type="datetime-local"
              value={receivedAt}
              max={toLocalInputValue(new Date())}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </Field>

          <Field label="Checked by" required htmlFor="delivery-staff">
            <Select
              id="delivery-staff"
              value={checkedBy}
              onChange={(event) => setCheckedBy(event.target.value)}
            >
              {data.staff
                .filter((person) => person.active)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Delivery note ref." hint="Optional" htmlFor="delivery-note">
            <TextInput
              id="delivery-note"
              value={deliveryNote}
              placeholder="DN-48219"
              onChange={(event) => setDeliveryNote(event.target.value)}
            />
          </Field>

          <Field label="Driver" hint="Optional" htmlFor="delivery-driver">
            <TextInput
              id="delivery-driver"
              value={driverName}
              placeholder="Name on the delivery note"
              onChange={(event) => setDriverName(event.target.value)}
            />
          </Field>

          <div className="flex items-end pb-1">
            <Checkbox
              label="Vehicle at correct temperature on arrival"
              description="Chilled and frozen compartments running as expected"
              checked={vehicleTempOk}
              onChange={(event) => setVehicleTempOk(event.target.checked)}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-ink text-sm font-semibold">
              Products
              <span className="text-ink-muted ml-1.5 font-normal">({lines.length})</span>
            </h3>
            <Button
              size="sm"
              onClick={() => setLines((current) => [...current, emptyLine()])}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add product
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <LineEditor
                key={line.id}
                line={line}
                index={index}
                showErrors={submitted}
                limit={deliveryTempLimit(line, data.settings)}
                concern={deliveryLineConcern(line, data.settings)}
                onChange={(changes) => updateLine(line.id, changes)}
                onRemove={
                  lines.length > 1
                    ? () => setLines((current) => current.filter((entry) => entry.id !== line.id))
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        <Field label="Delivery notes" hint="Optional — anything worth recording about this drop" htmlFor="delivery-notes">
          <Textarea
            id="delivery-notes"
            value={notes}
            placeholder="e.g. Driver waited while all chilled lines were probed."
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>

        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px]',
            status === 'accepted'
              ? 'border-pass-500/30 bg-pass-50 text-pass-700 dark:bg-pass-500/10 dark:text-pass-500'
              : 'border-fail-500/30 bg-fail-50 text-fail-700 dark:bg-fail-500/10 dark:text-fail-500',
          )}
        >
          {status !== 'accepted' ? <AlertTriangle className="size-4 shrink-0" /> : null}
          <span>
            {status === 'accepted'
              ? `All ${lines.length} line${lines.length === 1 ? '' : 's'} will be accepted.`
              : `${rejectedCount} of ${lines.length} line${lines.length === 1 ? '' : 's'} will be rejected.`}
          </span>
        </div>
      </div>
    </Modal>
  )
}

function LineEditor({
  line,
  index,
  limit,
  concern,
  showErrors,
  onChange,
  onRemove,
}: {
  line: DeliveryLine
  index: number
  limit: number | null
  concern: string | null
  showErrors: boolean
  onChange: (changes: Partial<DeliveryLine>) => void
  onRemove?: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3.5',
        line.accepted ? 'border-line bg-surface' : 'border-fail-500/35 bg-fail-50/50 dark:bg-fail-500/6',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
          Line {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {concern ? (
            <Badge tone="warn" icon={<AlertTriangle className="size-3.5" />}>
              {concern}
            </Badge>
          ) : null}
          {onRemove ? (
            <IconButton label="Remove line" size="sm" onClick={onRemove}>
              <Trash2 className="size-4" />
            </IconButton>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Product" required className="sm:col-span-2 lg:col-span-2">
          <TextInput
            value={line.product}
            placeholder="e.g. Chicken breast, skin-on"
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
            invalid={showErrors && Number.isNaN(line.quantity)}
            onChange={onChange}
          />
        </Field>

        {limit !== null ? <TemperatureField line={line} limit={limit} onChange={onChange} /> : null}

        <PackagingAndDateFields line={line} onChange={onChange} />
      </div>

      <div className="border-line mt-3 border-t pt-3">
        <AcceptanceRow line={line} showErrors={showErrors} onChange={onChange} />
      </div>
    </div>
  )
}
