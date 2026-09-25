import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, MapPin, Plus, PowerOff, ScanLine, X } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/config/navigation'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { MonitoredItem, TemperatureLog } from '@/data/types'
import { evaluateTemperature, formatRange, periodForTime } from '@/lib/compliance'
import { formatAgo, formatTemp, formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { FocusFrame } from '@/components/layout/FocusFrame'
import { LogoMark } from '@/components/layout/Logo'
import { readingValue, startsNegative } from '@/features/temperatures/reading'
import { CorrectiveActionField, ReadingInput, VerdictBanner } from '@/features/temperatures/ReadingFields'

/**
 * Where a QR label lands. Built for one hand at the fridge door: what this is,
 * one big box for the number, one big button, then a clear answer.
 */
export function ScanPage() {
  const { itemId = '' } = useParams()
  const { data, hasData } = useStore()
  const item = data.items.find((entry) => entry.id === itemId)

  if (!hasData || !item) return <NotOnThisDevice hasVenue={hasData} code={itemId} />
  if (!item.active) return <SwitchedOff item={item} />
  // Keyed so opening another label from here starts a clean form.
  return <ScanLogger key={item.id} item={item} />
}

function ScanTop() {
  const { data, hasData } = useStore()
  return (
    <>
      <LogoMark />
      <span className="text-ink min-w-0 flex-1 truncate text-[15px] font-bold">
        {(hasData && data.settings.venueName) || 'Mise'}
      </span>
      {hasData ? (
        <ButtonLink to="/" variant="ghost" size="sm" className="-mr-2 gap-1">
          <X className="size-4" />
          Close
        </ButtonLink>
      ) : null}
    </>
  )
}

/* -------------------------------------------------------------------------- */

function ScanLogger({ item }: { item: MonitoredItem }) {
  const now = useNow()
  const { data, activeStaffId, recordTemperature } = useStore()
  const [digits, setDigits] = useState('')
  const [negative, setNegative] = useState(() => startsNegative(item))
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [staffId, setStaffId] = useState(activeStaffId)
  const [changingStaff, setChangingStaff] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState<TemperatureLog | null>(null)

  const parsed = readingValue(digits, negative)
  const hasValue = !Number.isNaN(parsed)
  const outcome = hasValue ? evaluateTemperature(item, parsed) : undefined
  const needsCorrectiveAction = outcome === 'fail' && correctiveAction.trim() === ''
  const lastReading = data.temperatureLogs.find((log) => log.itemId === item.id)
  const staffList = data.staff.filter((person) => person.active)

  // Same rule as the Log sheet: scheduled equipment gets the window it was logged in.
  const scheduled = item.requiredChecks.length > 0
  const period = scheduled ? periodForTime(data.settings.periods, now) : undefined
  const checkWindow = data.settings.periods.find((entry) => entry.period === period)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!hasValue || staffId === '') return
    if (needsCorrectiveAction) {
      document.getElementById('scan-action')?.focus()
      return
    }

    const at = new Date()
    const log = recordTemperature({
      itemId: item.id,
      temperature: parsed,
      recordedAt: at.toISOString(),
      recordedBy: staffId,
      period: scheduled ? periodForTime(data.settings.periods, at) : undefined,
      correctiveAction: correctiveAction.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    setSaved(log)
    window.scrollTo({ top: 0 })
  }

  function logAnother() {
    setDigits('')
    setNegative(startsNegative(item))
    setCorrectiveAction('')
    setNotes('')
    setShowNotes(false)
    setSubmitted(false)
    setSaved(null)
    window.scrollTo({ top: 0 })
  }

  if (saved) return <SavedReading item={item} log={saved} onLogAnother={logAnother} />

  return (
    <FocusFrame
      top={<ScanTop />}
      onSubmit={handleSubmit}
      actions={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!hasValue || staffId === ''}
          className="h-14 w-full text-base sm:w-auto sm:min-w-52"
        >
          Save reading
        </Button>
      }
    >
      <ItemHeading item={item} />

      <div className="space-y-5">
        <div>
          <label htmlFor="scan-reading" className="text-ink mb-2 block text-[15px] font-semibold">
            Temperature
          </label>
          <ReadingInput
            id="scan-reading"
            size="lg"
            digits={digits}
            negative={negative}
            onDigitsChange={setDigits}
            onNegativeChange={setNegative}
            invalid={submitted && !hasValue}
            autoFocus
          />
        </div>

        <VerdictBanner item={item} temperature={parsed} outcome={outcome} />

        {outcome === 'fail' ? (
          <CorrectiveActionField
            id="scan-action"
            category={item.category}
            value={correctiveAction}
            onChange={setCorrectiveAction}
            error={submitted && needsCorrectiveAction ? 'Say what was done before saving.' : undefined}
            className="text-base"
          />
        ) : null}

        <div className="text-ink-muted space-y-1 text-sm">
          {scheduled ? (
            <p>
              {period && checkWindow && item.requiredChecks.includes(period)
                ? `Counts as the ${checkWindow.label.toLowerCase()} check (${checkWindow.startTime}–${checkWindow.endTime}).`
                : 'Outside this unit’s check times, so it’s saved as an extra reading.'}
            </p>
          ) : null}
          <p>
            {lastReading
              ? `Last reading ${formatTemp(lastReading.temperature)}, ${formatAgo(lastReading.recordedAt)}.`
              : 'No readings yet.'}
          </p>
        </div>

        <div className="bg-surface-muted/70 rounded-xl px-4 py-3">
          {staffList.length === 0 ? (
            <p className="text-ink-muted text-sm">Add a team member in Settings before logging readings.</p>
          ) : changingStaff ? (
            <Field label="Checked by" htmlFor="scan-staff">
              <Select
                id="scan-staff"
                className="h-12 text-base"
                value={staffId}
                onChange={(event) => setStaffId(event.target.value)}
              >
                {staffList.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-ink-muted flex items-center gap-x-1 text-sm">
              Checked by <span className="text-ink font-medium">{staffName(data, staffId)}</span>
              <button
                type="button"
                onClick={() => setChangingStaff(true)}
                className="text-brand-700 dark:text-brand-300 -my-2 ml-auto py-2 pl-3 font-semibold hover:underline"
              >
                Change
              </button>
            </p>
          )}
        </div>

        {showNotes ? (
          <Field label="Note" hint="Optional" htmlFor="scan-notes">
            <Textarea
              id="scan-notes"
              value={notes}
              autoFocus
              className="text-base"
              placeholder="e.g. Door seal looks worn."
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 py-1 text-sm font-semibold hover:underline"
          >
            <Plus className="size-4" />
            Add a note
          </button>
        )}
      </div>
    </FocusFrame>
  )
}

function ItemHeading({ item }: { item: MonitoredItem }) {
  const Icon = CATEGORY_ICONS[item.category]
  return (
    <div className="pt-4 pb-6">
      <p className="text-ink-muted flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4" />
        {CATEGORY_LABELS[item.category]}
      </p>
      <h1 className="text-ink mt-1 text-[28px] leading-tight font-bold tracking-tight">{item.name}</h1>
      <p className="text-ink-muted mt-1 flex items-center gap-1 text-[15px]">
        <MapPin className="size-4 shrink-0" />
        {item.location}
      </p>
      <p className="bg-surface border-line text-ink mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold">
        Safe range {formatRange(item)}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function SavedReading({
  item,
  log,
  onLogAnother,
}: {
  item: MonitoredItem
  log: TemperatureLog
  onLogAnother: () => void
}) {
  const { data } = useStore()
  const pass = log.outcome === 'pass'
  const checkWindow = data.settings.periods.find((entry) => entry.period === log.period)
  const check =
    item.requiredChecks.length === 0
      ? 'Probe reading'
      : log.period && checkWindow && item.requiredChecks.includes(log.period)
        ? `${checkWindow.label} check`
        : 'Extra reading'

  return (
    <FocusFrame
      top={<ScanTop />}
      actions={
        <>
          <Button variant="primary" size="lg" onClick={onLogAnother} className="h-14 w-full text-base sm:order-last sm:w-auto">
            Log another reading
          </Button>
          <ButtonLink to="/" size="lg" className="h-14 w-full text-base sm:w-auto">
            Done
          </ButtonLink>
        </>
      }
    >
      <div role="status" className="flex flex-col items-center pt-8 text-center">
        <span
          className={cn(
            'flex size-20 items-center justify-center rounded-full',
            pass
              ? 'bg-pass-50 text-pass-600 dark:bg-pass-500/12 dark:text-pass-500'
              : 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500',
          )}
        >
          {pass ? <CheckCircle2 className="size-11" /> : <AlertTriangle className="size-10" />}
        </span>
        <h1 className="text-ink mt-5 text-2xl font-bold">{pass ? 'Saved. All good.' : 'Saved. Out of range.'}</h1>
        <p
          className={cn(
            'tabular mt-1 text-6xl font-bold tracking-tight',
            pass ? 'text-pass-700 dark:text-pass-500' : 'text-fail-600 dark:text-fail-500',
          )}
        >
          {formatTemp(log.temperature)}
        </p>
        <p className="text-ink-muted mt-3 max-w-sm text-[15px]">
          {pass
            ? `${item.name} is within its safe range (${formatRange(item)}).`
            : `${item.name} should be ${formatRange(item)}. An issue has been raised so it gets followed up.`}
        </p>
      </div>

      <dl className="bg-surface border-line divide-line mt-8 divide-y rounded-xl border">
        <Detail label="Item">{item.name}</Detail>
        <Detail label="Check">{check}</Detail>
        <Detail label="Time">{formatTime(log.recordedAt)}</Detail>
        <Detail label="Checked by">{staffName(data, log.recordedBy)}</Detail>
        {log.correctiveAction ? <Detail label="Action taken">{log.correctiveAction}</Detail> : null}
      </dl>
    </FocusFrame>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="text-ink-muted w-28 shrink-0 text-sm">{label}</dt>
      <dd className="text-ink min-w-0 flex-1 text-sm font-medium">{children}</dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function NotOnThisDevice({ hasVenue, code }: { hasVenue: boolean; code: string }) {
  return (
    <FocusFrame
      top={<ScanTop />}
      actions={
        hasVenue ? (
          <ButtonLink to="/temperatures" variant="primary" size="lg" className="h-14 w-full text-base sm:w-auto">
            Go to temperatures
          </ButtonLink>
        ) : (
          <ButtonLink to="/setup" variant="primary" size="lg" className="h-14 w-full text-base sm:w-auto">
            Set up this device
          </ButtonLink>
        )
      }
    >
      <Notice icon={<ScanLine className="size-8" />} title="This item isn’t set up on this device">
        <p>
          Mise keeps a venue’s records on the device they’re entered on, so a label only opens on the device
          that holds them.
        </p>
        <p>
          {hasVenue
            ? 'If this is that device, the item may have been removed in Settings. You can still log a reading from the temperatures page.'
            : 'There’s no venue on this device yet.'}
        </p>
        {code ? <p className="text-ink-subtle font-mono text-xs break-all">Scanned code: {code}</p> : null}
      </Notice>
    </FocusFrame>
  )
}

function SwitchedOff({ item }: { item: MonitoredItem }) {
  return (
    <FocusFrame
      top={<ScanTop />}
      actions={
        <ButtonLink to="/temperatures" variant="primary" size="lg" className="h-14 w-full text-base sm:w-auto">
          Go to temperatures
        </ButtonLink>
      }
    >
      <Notice icon={<PowerOff className="size-8" />} title={`${item.name} isn’t being monitored`}>
        <p>
          It’s switched off in Settings, so no readings are expected for it. A manager can switch it back on
          under Settings, in Equipment.
        </p>
      </Notice>
    </FocusFrame>
  )
}

function Notice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <span className="bg-surface-muted text-ink-muted flex size-16 items-center justify-center rounded-full">
        {icon}
      </span>
      <h1 className="text-ink mt-5 text-2xl leading-tight font-bold">{title}</h1>
      <div className="text-ink-muted mt-3 max-w-md space-y-3 text-[15px]">{children}</div>
    </div>
  )
}
