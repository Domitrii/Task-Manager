import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/data/store'
import type { Delivery, DeliveryLine, DeliveryLineCategory } from '@/data/types'
import { deliveryLineConcern, deliveryTempLimit, deriveDeliveryStatus } from '@/lib/compliance'
import { cn, createId } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const LINE_CATEGORIES: Array<{ value: DeliveryLineCategory; label: string }> = [
  { value: 'chilled', label: 'Chilled' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'produce', label: 'Produce' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'non_food', label: 'Non-food' },
]

const UNITS = ['kg', 'g', 'litres', 'units', 'cases', 'trays', 'drums', 'rolls']

const REJECTION_REASONS = [
  'Temperature above the accepted limit on arrival',
  'Signs of thawing or refreezing',
  'Outer packaging damaged in transit',
  'Packaging contaminated or leaking',
  'Use-by date too short on arrival',
  'Incorrect product or quantity supplied',
  'Poor visual quality or odour',
]

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

export function DeliveryFormModal({
  open,
  onClose,
  existing,
}: {
  open: boolean
  onClose: () => void
  existing?: Delivery
}) {
  const { data, activeStaffId, saveDelivery } = useStore()
  const toast = useToast()

  // Mounted only while open, so the form seeds itself once from `existing`
  // (edit) or from sensible defaults (new) and needs no reset effect.
  const [supplierId, setSupplierId] = useState(
    () => existing?.supplierId ?? data.suppliers.find((supplier) => supplier.active)?.id ?? '',
  )
  const [receivedAt, setReceivedAt] = useState(() =>
    toLocalInputValue(existing ? new Date(existing.receivedAt) : new Date()),
  )
  const [checkedBy, setCheckedBy] = useState(existing?.checkedBy ?? activeStaffId)
  const [deliveryNote, setDeliveryNote] = useState(existing?.deliveryNote ?? '')
  const [driverName, setDriverName] = useState(existing?.driverName ?? '')
  const [vehicleTempOk, setVehicleTempOk] = useState(existing?.vehicleTempOk ?? true)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [lines, setLines] = useState<DeliveryLine[]>(
    () => existing?.lines.map((line) => ({ ...line })) ?? [emptyLine()],
  )
  const [submitted, setSubmitted] = useState(false)

  const status = useMemo(() => deriveDeliveryStatus(lines), [lines])
  const rejectedCount = lines.filter((line) => !line.accepted).length
  const missingProduct = lines.some((line) => line.product.trim() === '')
  const missingReason = lines.some((line) => !line.accepted && !line.rejectionReason)
  const canSave = supplierId !== '' && checkedBy !== '' && lines.length > 0 && !missingProduct && !missingReason

  function updateLine(id: string, changes: Partial<DeliveryLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line
        const next = { ...line, ...changes }

        // Switching category changes whether a temperature is meaningful.
        if (changes.category) {
          const needsTemp = deliveryTempLimit({ category: changes.category }, data.settings) !== null
          next.temperature = needsTemp ? (line.temperature ?? 0) : null
        }

        // Anything the rules flag defaults to rejected, but staff can override.
        const concern = deliveryLineConcern(next, data.settings)
        if (concern && line.accepted && (changes.temperature !== undefined || changes.packaging !== undefined)) {
          next.accepted = false
          next.rejectionReason = next.rejectionReason ?? concern
        }
        if (changes.accepted === true) next.rejectionReason = undefined
        return next
      }),
    )
  }

  function handleSave() {
    setSubmitted(true)
    if (!canSave) return

    const delivery: Delivery = {
      id: existing?.id ?? createId('dv'),
      supplierId,
      receivedAt: new Date(receivedAt).toISOString(),
      checkedBy,
      status,
      lines,
      deliveryNote: deliveryNote.trim() || undefined,
      driverName: driverName.trim() || undefined,
      vehicleTempOk,
      notes: notes.trim() || undefined,
    }

    saveDelivery(delivery, !existing)
    const supplier = data.suppliers.find((entry) => entry.id === supplierId)

    if (status === 'accepted') {
      toast.success(
        existing ? 'Delivery updated' : 'Delivery recorded',
        `${supplier?.name ?? 'Supplier'} · ${lines.length} line${lines.length === 1 ? '' : 's'} accepted.`,
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
      title={existing ? 'Edit delivery' : 'Record a delivery'}
      description="Check every line on arrival. Anything out of limits is flagged for rejection."
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Supplier"
            required
            htmlFor="delivery-supplier"
            hint={
              data.suppliers.some((supplier) => supplier.active)
                ? undefined
                : 'No suppliers yet. Add them in Settings, under Suppliers.'
            }
          >
            <Select
              id="delivery-supplier"
              value={supplierId}
              invalid={submitted && supplierId === ''}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Select a supplier…</option>
              {data.suppliers
                .filter((supplier) => supplier.active)
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </Select>
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
  const needsTemperature = limit !== null
  const isChilledish = line.category !== 'ambient' && line.category !== 'non_food'

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
          <Select
            value={line.category}
            onChange={(event) => onChange({ category: event.target.value as DeliveryLineCategory })}
          >
            {LINE_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Quantity">
          <div className="flex gap-2">
            <TextInput
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="tabular"
              value={line.quantity}
              onChange={(event) => onChange({ quantity: Number(event.target.value) })}
            />
            <Select
              value={line.unit}
              className="w-28"
              onChange={(event) => onChange({ unit: event.target.value })}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        {needsTemperature ? (
          <Field label="Temperature" hint={`Limit ${limit}°C`}>
            <TextInput
              type="number"
              inputMode="decimal"
              step="0.1"
              className="tabular"
              value={line.temperature ?? ''}
              onChange={(event) =>
                onChange({ temperature: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </Field>
        ) : null}

        <Field label="Packaging">
          <Select
            value={line.packaging}
            onChange={(event) => onChange({ packaging: event.target.value as DeliveryLine['packaging'] })}
          >
            <option value="good">Good — intact and clean</option>
            <option value="damaged">Damaged</option>
            <option value="contaminated">Contaminated / leaking</option>
          </Select>
        </Field>

        {isChilledish ? (
          <Field label="Use by">
            <TextInput
              type="date"
              value={line.useBy ?? ''}
              onChange={(event) => onChange({ useBy: event.target.value || undefined })}
            />
          </Field>
        ) : (
          <Field label="Best before">
            <TextInput
              type="date"
              value={line.bestBefore ?? ''}
              onChange={(event) => onChange({ bestBefore: event.target.value || undefined })}
            />
          </Field>
        )}
      </div>

      <div className="border-line mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
        <Checkbox
          label="Accepted"
          checked={line.accepted}
          onChange={(event) => onChange({ accepted: event.target.checked })}
        />
        {!line.accepted ? (
          <div className="min-w-0 flex-1">
            <Select
              value={line.rejectionReason ?? ''}
              invalid={showErrors && !line.rejectionReason}
              onChange={(event) => onChange({ rejectionReason: event.target.value || undefined })}
            >
              <option value="">Reason for rejection…</option>
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
              {line.rejectionReason && !REJECTION_REASONS.includes(line.rejectionReason) ? (
                <option value={line.rejectionReason}>{line.rejectionReason}</option>
              ) : null}
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  )
}
