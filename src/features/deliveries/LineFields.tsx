/**
 * The pieces of a delivery line that get checked on arrival, shared by the
 * delivery form and the order check-in so both apply the same rules.
 */
import type { DeliveryLine, DeliveryLineCategory } from '@/data/types'
import { Checkbox, Field, Select, TextInput } from '@/components/ui/Field'
import { LINE_CATEGORIES, REJECTION_REASONS, UNITS } from './lines'

export function CategorySelect({
  value,
  onChange,
  id,
}: {
  value: DeliveryLineCategory
  onChange: (category: DeliveryLineCategory) => void
  id?: string
}) {
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value as DeliveryLineCategory)}>
      {LINE_CATEGORIES.map((category) => (
        <option key={category.value} value={category.value}>
          {category.label}
        </option>
      ))}
    </Select>
  )
}

/** A number and its unit side by side. */
export function QuantityInput({
  quantity,
  unit,
  onChange,
  invalid,
  label = 'Quantity',
}: {
  quantity: number
  unit: string
  onChange: (changes: { quantity?: number; unit?: string }) => void
  invalid?: boolean
  label?: string
}) {
  return (
    <div className="flex gap-2">
      <TextInput
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        aria-label={label}
        className="tabular min-w-0"
        invalid={invalid}
        value={Number.isNaN(quantity) ? '' : quantity}
        onChange={(event) => onChange({ quantity: event.target.value === '' ? Number.NaN : Number(event.target.value) })}
      />
      <Select value={unit} className="w-28" aria-label="Unit" onChange={(event) => onChange({ unit: event.target.value })}>
        {UNITS.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
        {UNITS.includes(unit) ? null : <option value={unit}>{unit}</option>}
      </Select>
    </div>
  )
}

export function TemperatureField({
  line,
  limit,
  required,
  showErrors,
  onChange,
}: {
  line: DeliveryLine
  limit: number
  /** Check-in won't complete without a reading. */
  required?: boolean
  showErrors?: boolean
  onChange: (changes: Partial<DeliveryLine>) => void
}) {
  return (
    <Field label="Temperature" hint={`Limit ${limit}°C`} required={required}>
      <TextInput
        type="number"
        inputMode="decimal"
        step="0.1"
        className="tabular"
        aria-label={`Temperature of ${line.product || 'this line'}`}
        invalid={Boolean(required && showErrors && line.temperature === null)}
        value={line.temperature ?? ''}
        onChange={(event) => onChange({ temperature: event.target.value === '' ? null : Number(event.target.value) })}
      />
    </Field>
  )
}

/** Packaging and the date on the label: use-by for anything kept cold, best-before for the rest. */
export function PackagingAndDateFields({
  line,
  onChange,
}: {
  line: DeliveryLine
  onChange: (changes: Partial<DeliveryLine>) => void
}) {
  const keptCold = line.category !== 'ambient' && line.category !== 'non_food'
  return (
    <>
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

      {keptCold ? (
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
    </>
  )
}

/** Accepted, or rejected with a reason. */
export function AcceptanceRow({
  line,
  showErrors,
  onChange,
}: {
  line: DeliveryLine
  showErrors?: boolean
  onChange: (changes: Partial<DeliveryLine>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Checkbox
        label="Accepted"
        checked={line.accepted}
        onChange={(event) => onChange({ accepted: event.target.checked })}
      />
      {!line.accepted ? (
        <div className="min-w-0 flex-1">
          <Select
            value={line.rejectionReason ?? ''}
            aria-label="Reason for rejection"
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
  )
}

/** Pounds and pence per unit. Empty means not known yet. */
export function PriceInput({
  value,
  onChange,
  invalid,
  id,
  label = 'Price per unit',
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  invalid?: boolean
  id?: string
  label?: string
}) {
  return (
    <div className="relative">
      <span className="text-ink-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm" aria-hidden>
        £
      </span>
      <TextInput
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        aria-label={label}
        placeholder="0.00"
        className="tabular pl-7"
        invalid={invalid}
        value={value === undefined || Number.isNaN(value) ? '' : value}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      />
    </div>
  )
}
