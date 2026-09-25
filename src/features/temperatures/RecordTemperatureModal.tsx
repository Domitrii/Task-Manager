import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, Plus, Search } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/config/navigation'
import { selectActionableReadings, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { MonitoredCategory, MonitoredItem } from '@/data/types'
import { evaluateTemperature, formatRange, periodForTime, type CheckSlot } from '@/lib/compliance'
import { formatAgo, formatTemp } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { readingValue, startsNegative } from './reading'
import { CorrectiveActionField, ReadingInput, VerdictBanner } from './ReadingFields'

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
  const now = useNow()
  const { data, activeStaffId, recordTemperature } = useStore()
  const toast = useToast()

  // The parent mounts this component only while the modal is open, so plain
  // initialisers give a fresh form every time — no reset effect needed.
  const [itemId, setItemId] = useState<string | undefined>(defaultItemId)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MonitoredCategory | 'all'>('all')
  const [digits, setDigits] = useState('')
  const [negative, setNegative] = useState(() =>
    startsNegative(data.items.find((item) => item.id === defaultItemId)),
  )
  // Empty means "the moment it is saved", so a sheet left open doesn't stamp an old time.
  const [recordedAt, setRecordedAt] = useState('')
  const [staffId, setStaffId] = useState(activeStaffId)
  const [showDetails, setShowDetails] = useState(false)
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const available = useMemo(
    () =>
      data.items
        .filter((item) => item.active)
        .filter((item) => !restrictTo || restrictTo.includes(item.category))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.items, restrictTo],
  )

  /** Scheduled checks waiting to be done, in Today's order — the "next" in a round. */
  const queue = useMemo(
    () =>
      selectActionableReadings(data, now).filter((slot) => !restrictTo || restrictTo.includes(slot.item.category)),
    [data, now, restrictTo],
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
  const parsed = readingValue(digits, negative)
  const hasValue = !Number.isNaN(parsed)
  const outcome = selected && hasValue ? evaluateTemperature(selected, parsed) : undefined
  const lastReading = selected
    ? data.temperatureLogs.find((log) => log.itemId === selected.id)
    : undefined
  const upNext = selected ? queue.filter((slot) => slot.item.id !== selected.id) : []

  const needsCorrectiveAction = outcome === 'fail' && correctiveAction.trim().length === 0
  const canSave = Boolean(selected) && hasValue && staffId !== '' && !needsCorrectiveAction

  function choose(item: MonitoredItem | undefined) {
    setItemId(item?.id)
    setNegative(startsNegative(item))
    setDigits('')
    setCorrectiveAction('')
    setNotes('')
    setShowNotes(false)
    setSubmitted(false)
    setRecordedAt('')
  }

  function handleSave(then: 'close' | 'next' | 'another') {
    setSubmitted(true)
    if (!selected || !canSave) return

    const at = recordedAt ? new Date(recordedAt) : new Date()
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
        `${formatTemp(parsed)} saved. An issue has been raised so it gets followed up.`,
      )
    } else {
      toast.success(`${selected.name} saved`, `${formatTemp(parsed)}, within ${formatRange(selected)}.`)
    }

    if (then === 'next') choose(upNext[0]?.item)
    else if (then === 'another') choose(undefined)
    else onClose()
  }

  const staffList = data.staff.filter((person) => person.active)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selected ? selected.name : restrictTo?.every((entry) => entry === 'cooking' || entry === 'cooling') ? 'Log a food probe' : 'Log a temperature'}
      description={
        selected
          ? `${selected.location}. Safe range ${formatRange(selected)}.`
          : 'Choose what you checked.'
      }
      size="lg"
      footer={
        selected ? (
          <>
            {/* On phones the sheet's × and grab handle already dismiss it. */}
            <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">
              Cancel
            </Button>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {upNext.length > 0 ? (
                <>
                  <Button variant="secondary" size="lg" onClick={() => handleSave('close')} disabled={!canSave}>
                    Save and close
                  </Button>
                  <Button variant="primary" size="lg" onClick={() => handleSave('next')} disabled={!canSave}>
                    Save and next
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="lg" onClick={() => handleSave('another')} disabled={!canSave}>
                    Save, log another
                  </Button>
                  <Button variant="primary" size="lg" onClick={() => handleSave('close')} disabled={!canSave}>
                    Save
                  </Button>
                </>
              )}
            </div>
          </>
        ) : null
      }
    >
      {!selected ? (
        <ItemPicker
          due={query.trim() === '' && category === 'all' ? queue : []}
          items={filtered}
          categories={categories}
          category={category}
          onCategoryChange={setCategory}
          query={query}
          onQueryChange={setQuery}
          onSelect={choose}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => choose(undefined)}
              className="text-ink-muted hover:text-ink -ml-1 inline-flex items-center gap-1 text-sm font-medium"
            >
              <ChevronLeft className="size-4" />
              Pick something else
            </button>
            {upNext.length > 0 ? (
              <p className="text-ink-muted text-[13px]">
                Next: <span className="text-ink font-medium">{upNext[0].item.name}</span>
                {upNext.length > 1 ? `, then ${upNext.length - 1} more` : ''}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="temperature-value" className="text-ink mb-1.5 block text-sm font-semibold">
              Reading
            </label>
            <ReadingInput
              id="temperature-value"
              digits={digits}
              negative={negative}
              onDigitsChange={setDigits}
              onNegativeChange={setNegative}
              onEnter={() => {
                if (canSave) handleSave(upNext.length > 0 ? 'next' : 'close')
              }}
              invalid={submitted && !hasValue}
              autoFocus
            />
          </div>

          <VerdictBanner item={selected} temperature={parsed} outcome={outcome} />

          {lastReading ? (
            <p className="text-ink-muted text-[13px]">
              Last reading {formatTemp(lastReading.temperature)}, {formatAgo(lastReading.recordedAt)}
            </p>
          ) : null}

          {outcome === 'fail' ? (
            <CorrectiveActionField
              id="temperature-action"
              category={selected.category}
              value={correctiveAction}
              onChange={setCorrectiveAction}
              error={submitted && needsCorrectiveAction ? 'Say what was done before saving.' : undefined}
            />
          ) : null}

          <div className="bg-surface-muted/70 rounded-xl px-4 py-3">
            {!showDetails ? (
              <p className="text-ink-muted flex flex-wrap items-center gap-x-1 text-sm">
                Checked by <span className="text-ink font-medium">{staffName(data, staffId)}</span>
                {recordedAt ? `at ${format(new Date(recordedAt), 'HH:mm, d MMM')}` : 'just now'}
                <button
                  type="button"
                  onClick={() => setShowDetails(true)}
                  className="text-brand-700 dark:text-brand-300 ml-auto font-semibold hover:underline"
                >
                  Change
                </button>
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Checked by" required htmlFor="temperature-staff">
                  <Select id="temperature-staff" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
                    {staffList.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date and time" required htmlFor="temperature-at">
                  <TextInput
                    id="temperature-at"
                    type="datetime-local"
                    value={recordedAt || toLocalInputValue(now)}
                    max={toLocalInputValue(new Date())}
                    onChange={(event) => setRecordedAt(event.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          {showNotes ? (
            <Field label="Note" hint="Optional" htmlFor="temperature-notes">
              <Textarea
                id="temperature-notes"
                value={notes}
                autoFocus
                placeholder="e.g. Core probe, thickest part of the joint."
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              <Plus className="size-4" />
              Add a note
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}

function ItemPicker({
  due,
  items,
  categories,
  category,
  onCategoryChange,
  query,
  onQueryChange,
  onSelect,
}: {
  due: CheckSlot[]
  items: MonitoredItem[]
  categories: MonitoredCategory[]
  category: MonitoredCategory | 'all'
  onCategoryChange: (value: MonitoredCategory | 'all') => void
  query: string
  onQueryChange: (value: string) => void
  onSelect: (item: MonitoredItem) => void
}) {
  return (
    <div className="space-y-4">
      {due.length > 0 ? (
        <section>
          <h3 className="text-ink mb-2 text-sm font-semibold">Due now</h3>
          <div className="space-y-1.5">
            {due.map((slot) => (
              <ItemRow
                key={slot.item.id}
                item={slot.item}
                onSelect={onSelect}
                trailing={
                  slot.state === 'overdue' ? (
                    <Badge tone="fail">Missed</Badge>
                  ) : (
                    <Badge tone="warn">Due by {slot.window.endTime}</Badge>
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {due.length > 0 ? <h3 className="text-ink text-sm font-semibold">Everything</h3> : null}
        <div className="relative">
          <Search className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <TextInput
            value={query}
            placeholder="Search equipment or dish"
            className="h-11 pl-9 text-[15px]"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

        {categories.length > 1 ? (
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <FilterChip active={category === 'all'} onClick={() => onCategoryChange('all')}>
              All
            </FilterChip>
            {categories.map((entry) => (
              <FilterChip key={entry} active={category === entry} onClick={() => onCategoryChange(entry)}>
                {CATEGORY_LABELS[entry]}
              </FilterChip>
            ))}
          </div>
        ) : null}

        <div className="space-y-1.5">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onSelect={onSelect}
              trailing={<span className="text-ink-muted shrink-0 text-[13px]">{formatRange(item)}</span>}
            />
          ))}
          {items.length === 0 ? (
            <p className="text-ink-muted py-8 text-center text-sm">
              Nothing matches that search. Try the name on the unit's label.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function ItemRow({
  item,
  trailing,
  onSelect,
}: {
  item: MonitoredItem
  trailing: React.ReactNode
  onSelect: (item: MonitoredItem) => void
}) {
  const Icon = CATEGORY_ICONS[item.category]
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="border-line hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/8 flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
    >
      <span className="bg-surface-muted text-ink-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-[15px] font-semibold">{item.name}</span>
        <span className="text-ink-muted block truncate text-[13px]">{item.location}</span>
      </span>
      {trailing}
    </button>
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
        'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line-default text-ink-muted hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
