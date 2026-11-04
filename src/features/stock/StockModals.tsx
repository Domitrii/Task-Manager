import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/data/store'
import type { StockItem } from '@/data/types'
import { formatQuantity } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export function DeleteStockModal({ item, onClose }: { item: StockItem | undefined; onClose: () => void }) {
  const { deleteStockItem } = useStore()
  const toast = useToast()

  if (!item) return null

  function handleDelete() {
    if (!item) return
    deleteStockItem(item.id)
    toast.success('Stock item deleted', `${item.name} is no longer being tracked.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete this stock item?"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete item
          </Button>
        </>
      }
    >
      <p className="text-ink-muted text-sm">
        {item.name} will no longer be tracked or flagged for ordering. This can’t be undone.
      </p>
    </Modal>
  )
}

export function CountModal({ item, onClose }: { item: StockItem | undefined; onClose: () => void }) {
  const { activeStaffId, updateStock } = useStore()
  const toast = useToast()
  const [value, setValue] = useState('')

  if (!item) return null

  function handleSave() {
    if (!item || value.trim() === '') return
    updateStock(item.id, {
      quantity: Number(value),
      lastCountedAt: new Date().toISOString(),
      lastCountedBy: activeStaffId,
    })
    toast.success(`${item.name} counted`, `Now ${formatQuantity(Number(value), item.unit)} on hand.`)
    setValue('')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Count ${item.name}`}
      description={`Currently showing ${formatQuantity(item.quantity, item.unit)} · par level ${formatQuantity(item.parLevel, item.unit)}`}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={value.trim() === ''}>
            Save count
          </Button>
        </>
      }
    >
      <Field label={`Quantity on hand (${item.unit})`} required htmlFor="stock-count">
        <TextInput
          id="stock-count"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          autoFocus
          className="tabular h-12 text-lg font-semibold"
          value={value}
          placeholder={String(item.quantity)}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      {value.trim() !== '' && Number(value) <= item.parLevel ? (
        <p className="text-warn-600 dark:text-warn-500 mt-3 flex items-center gap-1.5 text-[13px]">
          <AlertTriangle className="size-4" />
          This will be at or below par level — worth ordering.
        </p>
      ) : null}
    </Modal>
  )
}

