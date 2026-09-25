/**
 * Pieces of a temperature entry shared by the Log sheet and the scan page, so
 * a reading is typed, judged and corrected the same way wherever it's taken.
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { MonitoredCategory, MonitoredItem } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { formatTemp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Field, Textarea } from '@/components/ui/Field'

/** The fixes people actually write down, one tap each. They can still type their own. */
const QUICK_ACTIONS: Record<MonitoredCategory, string[]> = {
  fridge: ['Door was left open, closed it', 'Adjusted the thermostat', 'Moved stock to another fridge', 'Will re-check in 30 minutes', 'Called an engineer', 'Threw away affected food'],
  display_fridge: ['Adjusted the thermostat', 'Moved stock to another fridge', 'Will re-check in 30 minutes', 'Called an engineer', 'Threw away affected food'],
  freezer: ['Door was left open, closed it', 'Adjusted the thermostat', 'Moved stock to another freezer', 'Will re-check in 30 minutes', 'Called an engineer'],
  hot_holding: ['Reheated to 75°C or above', 'Turned the unit up', 'Will re-check in 30 minutes', 'Threw away food held below 63°C for over 2 hours'],
  cooking: ['Cooked for longer and re-probed', 'Threw away the batch'],
  cooling: ['Moved to the blast chiller', 'Split into smaller portions', 'Threw away the batch'],
}

/**
 * Digits plus a separate sign toggle: phone number pads have no minus key, and
 * freezer readings need one.
 */
export function ReadingInput({
  id,
  digits,
  negative,
  onDigitsChange,
  onNegativeChange,
  onEnter,
  invalid,
  autoFocus,
  size = 'md',
}: {
  id: string
  digits: string
  negative: boolean
  onDigitsChange: (digits: string) => void
  onNegativeChange: (negative: boolean) => void
  onEnter?: () => void
  invalid?: boolean
  autoFocus?: boolean
  size?: 'md' | 'lg'
}) {
  const large = size === 'lg'

  function handleDigits(raw: string) {
    let value = raw.replace(',', '.').replace(/\s/g, '')
    // A hardware keyboard can still type the sign; phone keypads use the toggle.
    if (value.startsWith('-') || value.startsWith('−')) {
      onNegativeChange(true)
      value = value.slice(1)
    } else if (value.startsWith('+')) {
      onNegativeChange(false)
      value = value.slice(1)
    }
    if (/^\d{0,3}(\.\d?)?$/.test(value)) onDigitsChange(value)
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        {negative ? (
          <span
            className={cn(
              'text-ink pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-bold',
              large ? 'text-5xl' : 'text-3xl',
            )}
          >
            −
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={digits}
          placeholder="0.0"
          aria-invalid={invalid}
          onChange={(event) => handleDigits(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onEnter?.()
          }}
          className={cn(
            'border-line-default bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:ring-brand-500/15 w-full rounded-xl border pr-14 font-bold transition-colors focus:ring-3 focus:outline-none',
            large ? 'tabular h-20 text-5xl' : 'h-16 text-3xl',
            negative ? (large ? 'pl-11' : 'pl-9') : 'pl-4',
            invalid && 'border-fail-500',
          )}
        />
        <span
          className={cn(
            'text-ink-muted pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-semibold',
            large ? 'text-2xl' : 'text-lg',
          )}
        >
          °C
        </span>
      </div>
      <button
        type="button"
        onClick={() => onNegativeChange(!negative)}
        aria-pressed={negative}
        aria-label={negative ? 'Make the reading positive' : 'Make the reading negative'}
        className={cn(
          'shrink-0 rounded-xl border font-bold transition-colors',
          large ? 'h-20 w-20 text-2xl' : 'h-16 w-16 text-xl',
          negative
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-line-default bg-surface text-ink hover:bg-surface-muted',
        )}
      >
        +/−
      </button>
    </div>
  )
}

export function VerdictBanner({
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
      <div className="border-line-default text-ink-muted rounded-xl border border-dashed px-4 py-3 text-sm">
        Type the reading and we'll check it against {formatRange(item)}.
      </div>
    )
  }

  const pass = outcome === 'pass'
  const overBy = item.maxTemp !== null && temperature > item.maxTemp ? temperature - item.maxTemp : null
  const underBy = item.minTemp !== null && temperature < item.minTemp ? item.minTemp - temperature : null

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
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
            'text-[15px] font-bold',
            pass ? 'text-pass-700 dark:text-pass-500' : 'text-fail-700 dark:text-fail-500',
          )}
        >
          {pass ? 'Safe' : overBy !== null ? `Too warm by ${formatTemp(overBy)}` : underBy !== null ? `Too cold by ${formatTemp(underBy)}` : 'Out of range'}
        </p>
        <p className="text-ink-muted mt-0.5 text-sm">
          {formatTemp(temperature)} against {formatRange(item)}.
          {pass ? '' : ' Say what you did about it below.'}
        </p>
      </div>
    </div>
  )
}

/** Required on every failed reading. This is what an inspector reads. */
export function CorrectiveActionField({
  id,
  category,
  value,
  onChange,
  error,
  className,
}: {
  id: string
  category: MonitoredCategory
  value: string
  onChange: (value: string) => void
  error?: string
  /** Applied to the text box, e.g. a larger size on phones. */
  className?: string
}) {
  function addQuickAction(text: string) {
    if (value.includes(text)) return
    const trimmed = value.trim()
    onChange(trimmed ? `${trimmed.replace(/[.\s]*$/, '')}. ${text}.` : `${text}.`)
  }

  return (
    <Field
      label="What did you do about it?"
      required
      hint="Tap any that apply, or write your own. This is what an inspector reads."
      error={error}
      htmlFor={id}
    >
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS[category].map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => addQuickAction(action)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
              value.includes(action)
                ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-500/12 dark:text-brand-200'
                : 'border-line-default text-ink hover:border-line-strong',
            )}
          >
            {action}
          </button>
        ))}
      </div>
      <Textarea
        id={id}
        value={value}
        className={className}
        placeholder="e.g. Moved stock to Walk-in Fridge 2 and called the engineer."
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}
