import { useState } from 'react'
import { Check } from 'lucide-react'
import { useStore } from '@/data/store'
import type { Supplier, Weekday } from '@/data/types'
import { cn, createId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, ProblemCount, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** Adding a supplier, or changing one. */
export function AddSupplierModal({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const { saveSupplier } = useStore()
  const toast = useToast()
  const [name, setName] = useState(supplier?.name ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [days, setDays] = useState<Weekday[]>(supplier?.deliveryDays ?? [])
  const [submitted, setSubmitted] = useState(false)

  const noName = submitted && name.trim() === ''
  const badEmail = submitted && email.trim() !== '' && !validEmail(email.trim())
  const problems = [noName, badEmail].filter(Boolean).length

  function toggleDay(day: Weekday) {
    setDays((current) => (current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]))
  }

  function save() {
    setSubmitted(true)
    if (name.trim() === '' || (email.trim() !== '' && !validEmail(email.trim()))) return
    saveSupplier({
      ...(supplier ?? { id: createId('sup'), categories: ['chilled'], active: true }),
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      deliveryDays: WEEKDAYS.map((day) => day.value).filter((day) => days.includes(day)),
    })
    toast.success(supplier ? 'Supplier saved' : 'Supplier added')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="page"
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      footer={
        <Button variant="primary" size="lg" onClick={save}>
          Save supplier
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted text-[13px]">Required fields are marked *</p>
        <ProblemCount count={problems} />
        <Field label="Name" required htmlFor="supplier-name" error={noName ? 'Enter a supplier name' : undefined}>
          <TextInput
            id="supplier-name"
            autoFocus={!supplier}
            value={name}
            invalid={noName}
            placeholder="e.g. City Bakery"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label="Email (optional)"
          htmlFor="supplier-email"
          hint="Example format: orders@citybakery.example"
          error={badEmail ? 'Enter a valid email address' : undefined}
        >
          <TextInput
            id="supplier-email"
            type="email"
            value={email}
            invalid={badEmail}
            placeholder="orders@citybakery.example"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Phone (optional)" htmlFor="supplier-phone">
          <TextInput
            id="supplier-phone"
            type="tel"
            value={phone}
            placeholder="Enter a phone number"
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field label="Address (optional)" htmlFor="supplier-address">
          <TextInput id="supplier-address" value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <fieldset>
          <legend className="text-ink mb-1.5 text-[13px] font-medium">Delivery days (optional)</legend>
          <div className="grid grid-cols-3 gap-2">
            {WEEKDAYS.map((day) => {
              const on = days.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'flex h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition-colors',
                    on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-ink',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border',
                      on ? 'border-white/70' : 'border-line-strong',
                    )}
                  >
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  {day.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
