import { useState } from 'react'
import { useStore } from '@/data/store'
import type { StockCategory } from '@/data/types'
import { titleCase } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, ProblemCount, Select, Stepper, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const UNITS = ['rolls', 'packs', 'boxes', 'bottles', 'tins', 'each', 'kg', 'g', 'L', 'ml']
const CATEGORIES: StockCategory[] = ['dry', 'produce', 'dairy', 'meat', 'fish', 'frozen', 'drinks', 'packaging']

export function AddStockItemModal({ onClose }: { onClose: () => void }) {
  const { data, addStockItem } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [unit, setUnit] = useState('packs')
  const [parLevel, setParLevel] = useState(0)
  const [supplierId, setSupplierId] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState<StockCategory>('dry')
  const [submitted, setSubmitted] = useState(false)

  const noName = submitted && name.trim() === ''
  const badQuantity = submitted && quantity < 0
  const badLevel = submitted && parLevel < 0
  const problems = [noName, badQuantity, badLevel].filter(Boolean).length

  function save() {
    setSubmitted(true)
    if (name.trim() === '' || quantity < 0 || parLevel < 0) return
    addStockItem({
      name: name.trim(),
      category,
      unit,
      quantity,
      parLevel,
      location: location.trim(),
      supplierId: supplierId || undefined,
    })
    toast.success('Item added')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="page"
      title="Add stock item"
      footer={
        <Button variant="primary" size="lg" onClick={save}>
          Save item
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted text-[13px]">Required fields are marked *</p>
        <ProblemCount count={problems} />
        <Field label="Name" required htmlFor="stock-name" error={noName ? 'Enter an item name' : undefined}>
          <TextInput
            id="stock-name"
            autoFocus
            value={name}
            invalid={noName}
            placeholder="e.g. Blue roll"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Quantity" required htmlFor="stock-quantity" error={badQuantity ? 'Quantity must be zero or more' : undefined}>
          <Stepper id="stock-quantity" label="quantity" unit={unit} value={quantity} onChange={setQuantity} invalid={badQuantity} />
        </Field>
        <Field label="Unit" required htmlFor="stock-unit">
          <Select id="stock-unit" value={unit} onChange={(event) => setUnit(event.target.value)}>
            {UNITS.map((entry) => (
              <option key={entry} value={entry}>
                {titleCase(entry)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Low-stock level"
          htmlFor="stock-level"
          hint="Zero or more. Flag this item when quantity is below this level."
          error={badLevel ? 'Low-stock level must be zero or more' : undefined}
        >
          <Stepper id="stock-level" label="low-stock level" unit={unit} value={parLevel} onChange={setParLevel} invalid={badLevel} />
        </Field>
        <Field label="Supplier (optional)" htmlFor="stock-supplier">
          <Select id="stock-supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">No supplier</option>
            {data.suppliers
              .filter((entry) => entry.active)
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Location (optional)" htmlFor="stock-location">
          <TextInput
            id="stock-location"
            value={location}
            placeholder="e.g. Prep shelf"
            onChange={(event) => setLocation(event.target.value)}
          />
        </Field>
        <Field label="Category" htmlFor="stock-category">
          <Select id="stock-category" value={category} onChange={(event) => setCategory(event.target.value as StockCategory)}>
            {CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {titleCase(entry)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
