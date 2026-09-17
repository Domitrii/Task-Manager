import { useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, Package, Plus, TrendingDown } from 'lucide-react'
import { selectLowStock, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { StockCategory, StockItem } from '@/data/types'
import { formatAgo, formatMoney, formatQuantity } from '@/lib/format'
import { cn, sum, titleCase } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { ProgressBar } from '@/components/shared/ProgressRing'
import { StatCard } from '@/components/shared/StatCard'

const CATEGORIES: StockCategory[] = ['meat', 'fish', 'dairy', 'produce', 'dry', 'frozen', 'drinks', 'packaging']

export function StockPage() {
  const { data } = useStore()
  const [tab, setTab] = useState<'all' | 'low'>('all')
  const [categoryFilter, setCategoryFilter] = useState<StockCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [counting, setCounting] = useState<StockItem | undefined>(undefined)
  const [adding, setAdding] = useState(false)

  const low = useMemo(() => selectLowStock(data), [data])
  const source = tab === 'low' ? low : data.stock

  const filtered = useMemo(
    () =>
      source
        .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
        .filter((item) =>
          query.trim() === '' ? true : item.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [source, categoryFilter, query],
  )

  const stockValue = sum(data.stock.map((item) => item.quantity * (item.costPerUnit ?? 0)))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock & inventory"
        description="Counted by hand and compared against par levels, so ordering decisions are based on what is actually on the shelf."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="size-4" />
            Add item
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Items tracked"
          value={data.stock.length}
          sublabel={`${new Set(data.stock.map((item) => item.location)).size} storage locations`}
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="At or below par"
          value={low.length}
          sublabel={low.length > 0 ? 'Needs ordering' : 'Everything above par level'}
          icon={<TrendingDown className="size-4" />}
          tone={low.length > 0 ? 'warn' : 'pass'}
        />
        <StatCard
          label="Out of stock"
          value={data.stock.filter((item) => item.quantity <= 0).length}
          sublabel="Zero on hand"
          icon={<AlertTriangle className="size-4" />}
          tone={data.stock.some((item) => item.quantity <= 0) ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Stock on hand"
          value={formatMoney(stockValue)}
          sublabel="At last recorded cost price"
          icon={<ClipboardList className="size-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All stock', count: data.stock.length },
              { value: 'low', label: 'Needs ordering', count: low.length },
            ]}
          />
        </div>

        <div className="border-line flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
          <TextInput
            value={query}
            placeholder="Search stock"
            className="w-auto min-w-52 flex-1 sm:max-w-xs"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            value={categoryFilter}
            className="w-auto min-w-40"
            aria-label="Filter by category"
            onChange={(event) => setCategoryFilter(event.target.value as StockCategory | 'all')}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {titleCase(category)}
              </option>
            ))}
          </Select>
          <p className="text-ink-muted ml-auto text-[13px]">{filtered.length} items</p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title="No stock items match" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Location</Th>
                <Th numeric>On hand</Th>
                <Th numeric>Par level</Th>
                <Th>Level</Th>
                <Th>Last counted</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const ratio = item.parLevel === 0 ? 1 : item.quantity / item.parLevel
                return (
                  <Tr key={item.id}>
                    <Td>
                      <span className="text-ink block text-[13px] font-medium">{item.name}</span>
                      <span className="text-ink-subtle text-[11px]">{titleCase(item.category)}</span>
                    </Td>
                    <Td>
                      <span className="text-ink-muted text-[13px]">{item.location}</span>
                    </Td>
                    <Td numeric>
                      <span
                        className={cn(
                          'text-[13px] font-semibold',
                          item.quantity <= 0
                            ? 'text-fail-600 dark:text-fail-500'
                            : ratio <= 1
                              ? 'text-warn-600 dark:text-warn-500'
                              : 'text-ink',
                        )}
                      >
                        {formatQuantity(item.quantity, item.unit)}
                      </span>
                    </Td>
                    <Td numeric>
                      <span className="text-ink-muted text-[13px]">
                        {formatQuantity(item.parLevel, item.unit)}
                      </span>
                    </Td>
                    <Td>
                      <div className="w-28">
                        <ProgressBar
                          value={Math.min(ratio, 1.5) * 66}
                          tone={item.quantity <= 0 ? 'fail' : ratio <= 1 ? 'warn' : 'pass'}
                        />
                      </div>
                    </Td>
                    <Td>
                      <span className="text-ink-muted text-[13px]">
                        {item.lastCountedAt ? formatAgo(item.lastCountedAt) : 'Never'}
                      </span>
                      {item.lastCountedBy ? (
                        <span className="text-ink-subtle block text-[11px]">
                          {staffName(data, item.lastCountedBy)}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" onClick={() => setCounting(item)}>
                        Count
                      </Button>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <CountModal item={counting} onClose={() => setCounting(undefined)} />
      <AddStockModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function CountModal({ item, onClose }: { item: StockItem | undefined; onClose: () => void }) {
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
          <Button variant="ghost" onClick={onClose}>
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

function AddStockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addStockItem } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StockCategory>('dry')
  const [unit, setUnit] = useState('kg')
  const [quantity, setQuantity] = useState('0')
  const [parLevel, setParLevel] = useState('0')
  const [location, setLocation] = useState('Dry Store')
  const [supplierId, setSupplierId] = useState('')

  function handleSave() {
    if (!name.trim()) return
    addStockItem({
      name: name.trim(),
      category,
      unit,
      quantity: Number(quantity) || 0,
      parLevel: Number(parLevel) || 0,
      location: location.trim() || 'Unassigned',
      supplierId: supplierId || undefined,
    })
    toast.success('Stock item added', `${name.trim()} is now being tracked.`)
    setName('')
    setQuantity('0')
    setParLevel('0')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a stock item"
      description="Tracked manually — counts are entered by the team."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
            Add item
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item name" required htmlFor="stock-name">
          <TextInput
            id="stock-name"
            value={name}
            autoFocus
            placeholder="e.g. Free-range eggs"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="stock-category">
            <Select
              id="stock-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as StockCategory)}
            >
              {CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {titleCase(entry)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unit" htmlFor="stock-unit">
            <Select id="stock-unit" value={unit} onChange={(event) => setUnit(event.target.value)}>
              {['kg', 'g', 'litres', 'units', 'cases', 'trays', 'bottles', 'rolls'].map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity on hand" htmlFor="stock-qty">
            <TextInput
              id="stock-qty"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="tabular"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label="Par level" hint="Reorder at or below this" htmlFor="stock-par">
            <TextInput
              id="stock-par"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="tabular"
              value={parLevel}
              onChange={(event) => setParLevel(event.target.value)}
            />
          </Field>
          <Field label="Location" htmlFor="stock-location">
            <TextInput
              id="stock-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </Field>
          <Field label="Supplier" hint="Optional" htmlFor="stock-supplier">
            <Select
              id="stock-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">No preferred supplier</option>
              {data.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Badge tone="neutral">Counts are entered manually — no integrations required</Badge>
      </div>
    </Modal>
  )
}
