import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, ChevronLeft, Search } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/config/navigation'
import { useStore } from '@/data/store'
import type { MonitoredCategory, MonitoredItem } from '@/data/types'
import { evaluateTemperature, formatRange, periodForTime } from '@/lib/compliance'
import { formatRelativeDay, formatTemp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Select, TemperatureInput, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const CATEGORY_ORDER: MonitoredCategory[] = [
  'fridge',
  'freezer',
  'display_fridge',
  'hot_holding',
  'cooking',
  'cooling',
]

/** `datetime-local` wants a local, second-less string — not an ISO UTC stamp. */
function toLocalInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export function RecordTemperatureModal({
  open,
  onClose,
  defaultItemId,
  restrictTo,
}: {
  open: boolean
  onClose: () => void
  defaultItemId?: string
  /** Limits the picker to one section, e.g. only fridges on the fridge page. */
  restrictTo?: MonitoredCategory[]
}) {
  const { data, activeStaffId, recordTemperature } = useStore()
  const toast = useToast()

  // The parent mounts this component only while the modal is open, so plain
  // initialisers give a fresh form every time — no reset effect needed.
  const [itemId, setItemId] = useState<string | undefined>(defaultItemId)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MonitoredCategory | 'all'>('all')
  const [temperature, setTemperature] = useState('')
  const [recordedAt, setRecordedAt] = useState(() => toLocalInputValue(new Date()))
  const [staffId, setStaffId] = useState(activeStaffId)
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const available = useMemo(
    () =>
      data.items
        .filter((item) => item.active)
        .filter((item) => !restrictTo || restrictTo.includes(item.category))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.items, restrictTo],
  )

  const filtered = useMemo(
    () =>
      available
        .filter((item) => category === 'all' || item.category === category)
        .filter((item) =>
          query.trim() === ''
            ? true
            : `${item.name} ${item.location}`.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    [available, category, query],
  )

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((entry) => available.some((item) => item.category === entry)),
    [available],
  )

  const selected = itemId ? data.items.find((item) => item.id === itemId) : undefined
  const parsed = temperature.trim() === '' ? Number.NaN : Number(temperature)
  const hasValue = !Number.isNaN(parsed)
  const outcome = selected && hasValue ? evaluateTemperature(selected, parsed) : undefined
  const lastReading = selected
    ? data.temperatureLogs.find((log) => log.itemId === selected.id)
    : undefined

  const needsCorrectiveAction = outcome === 'fail' && correctiveAction.trim().length === 0
  const canSave = Boolean(selected) && hasValue && staffId !== '' && !needsCorrectiveAction

  function handleSave(addAnother: boolean) {
    setSubmitted(true)
    if (!selected || !canSave) return

    const at = new Date(recordedAt)
    recordTemperature({
      itemId: selected.id,
      temperature: parsed,
      recordedAt: at.toISOString(),
      recordedBy: staffId,
      period: selected.requiredChecks.length > 0 ? periodForTime(data.settings.periods, at) : undefined,
      correctiveAction: correctiveAction.trim() || undefined,
      notes: notes.trim() || undefined,
    })

    if (outcome === 'fail') {
      toast.error(
        `${selected.name} out of range`,
        `${formatTemp(parsed)} recorded — a food safety issue has been raised.`,
      )
    } else {
      toast.success(`${selected.name} recorded`, `${formatTemp(parsed)} — within ${formatRange(selected)}.`)
    }

    if (addAnother) {
      setItemId(undefined)
      setTemperature('')
      setCorrectiveAction('')
      setNotes('')
      setSubmitted(false)
      setRecordedAt(toLocalInputValue(new Date()))
    } else {
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selected ? `Record ${selected.name}` : 'Record a temperature'}
      description={
        selected
          ? `Safe range ${formatRange(selected)} · ${selected.location}`
          : 'Choose the equipment or dish you have probed.'
      }
      size="lg"
      footer={
        selected ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={!canSave}>
              Save & add another
            </Button>
            <Button variant="primary" onClick={() => handleSave(false)} disabled={!canSave}>
              Save reading
            </Button>
          </>
        ) : null
      }
    >
      {!selected ? (
        <ItemPicker
          items={filtered}
          categories={categories}
          category={category}
          onCategoryChange={setCategory}
          query={query}
          onQueryChange={setQuery}
          onSelect={setItemId}
        />
      ) : (
        <div className="space-y-4">
          {!defaultItemId ? (
            <button
              type="button"
              onClick={() => setItemId(undefined)}
              className="text-ink-muted hover:text-ink -ml-1 inline-flex items-center gap-1 text-[13px] font-medium"
            >
              <ChevronLeft className="size-4" />
              Choose a different item
            </button>
          ) : null}

          <Field label="Temperature" required htmlFor="temperature-value">
            <TemperatureInput
              id="temperature-value"
              autoFocus
              value={temperature}
              placeholder="0.0"
              invalid={submitted && !hasValue}
              onChange={(event) => setTemperature(event.target.value)}
            />
          </Field>

          <VerdictBanner item={selected} temperature={parsed} outcome={outcome} />

          {lastReading ? (
            <p className="text-ink-muted text-[13px]">
              Last reading {formatTemp(lastReading.temperature)} ·{' '}
              {formatRelativeDay(lastReading.recordedAt)}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date & time" required htmlFor="temperature-at">
              <TextInput
                id="temperature-at"
                type="datetime-local"
                value={recordedAt}
                max={toLocalInputValue(new Date())}
                onChange={(event) => setRecordedAt(event.target.value)}
              />
            </Field>
            <Field label="Checked by" required htmlFor="temperature-staff">
              <Select
                id="temperature-staff"
                value={staffId}
                onChange={(event) => setStaffId(event.target.value)}
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
          </div>

          {outcome === 'fail' ? (
            <Field
              label="Corrective action"
              required
              hint="What was done about it? This is what an inspector will read."
              error={submitted && needsCorrectiveAction ? 'Record the action taken.' : undefined}
              htmlFor="temperature-action"
            >
              <Textarea
                id="temperature-action"
                value={correctiveAction}
                placeholder="e.g. Stock moved to Walk-in Fridge 2, engineer called, re-probed after 30 minutes."
                onChange={(event) => setCorrectiveAction(event.target.value)}
              />
            </Field>
          ) : null}

          <Field label="Notes" hint="Optional" htmlFor="temperature-notes">
            <Textarea
              id="temperature-notes"
              value={notes}
              placeholder="e.g. Core probe, thickest part of the joint."
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

function VerdictBanner({
  item,
  temperature,
  outcome,
}: {
  item: MonitoredItem
  temperature: number
  outcome: 'pass' | 'fail' | undefined
}) {
  if (outcome === undefined) {
    return (
      <div className="border-line bg-surface-muted/60 text-ink-muted rounded-lg border border-dashed px-3.5 py-3 text-[13px]">
        Enter a reading to check it against {formatRange(item)}.
      </div>
    )
  }

  const pass = outcome === 'pass'
  const overBy = item.maxTemp !== null && temperature > item.maxTemp ? temperature - item.maxTemp : null
  const underBy = item.minTemp !== null && temperature < item.minTemp ? item.minTemp - temperature : null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3.5 py-3',
        pass
          ? 'border-pass-500/30 bg-pass-50 dark:bg-pass-500/10'
          : 'border-fail-500/30 bg-fail-50 dark:bg-fail-500/10',
      )}
    >
      {pass ? (
        <CheckCircle2 className="text-pass-600 dark:text-pass-500 mt-0.5 size-5 shrink-0" />
      ) : (
        <AlertTriangle className="text-fail-600 dark:text-fail-500 mt-0.5 size-5 shrink-0" />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm font-semibold',
            pass ? 'text-pass-700 dark:text-pass-500' : 'text-fail-700 dark:text-fail-500',
          )}
        >
          {pass ? 'Within safe range' : 'Outside safe range'}
        </p>
        <p className="text-ink-muted mt-0.5 text-[13px]">
          {formatTemp(temperature)} against {formatRange(item)}
          {overBy !== null ? ` — ${formatTemp(overBy)} too warm.` : ''}
          {underBy !== null ? ` — ${formatTemp(underBy)} too cold.` : ''}
          {pass ? '.' : ' A corrective action is required.'}
        </p>
      </div>
    </div>
  )
}

function ItemPicker({
  items,
  categories,
  category,
  onCategoryChange,
  query,
  onQueryChange,
  onSelect,
}: {
  items: MonitoredItem[]
  categories: MonitoredCategory[]
  category: MonitoredCategory | 'all'
  onCategoryChange: (value: MonitoredCategory | 'all') => void
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <TextInput
          value={query}
          autoFocus
          placeholder="Search equipment or dish"
          className="pl-9"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      {categories.length > 1 ? (
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <FilterChip active={category === 'all'} onClick={() => onCategoryChange('all')}>
            All
          </FilterChip>
          {categories.map((entry) => (
            <FilterChip
              key={entry}
              active={category === entry}
              onClick={() => onCategoryChange(entry)}
            >
              {CATEGORY_LABELS[entry]}
            </FilterChip>
          ))}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = CATEGORY_ICONS[item.category]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="border-line hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/8 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
            >
              <span className="bg-surface-muted text-ink-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-sm font-medium">{item.name}</span>
                <span className="text-ink-muted block truncate text-xs">{item.location}</span>
              </span>
              <Badge tone="neutral" className="shrink-0">
                {formatRange(item)}
              </Badge>
            </button>
          )
        })}
        {items.length === 0 ? (
          <p className="text-ink-muted py-8 text-center text-sm">No equipment matches that search.</p>
        ) : null}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line-default text-ink-muted hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
