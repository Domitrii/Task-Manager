import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId, useState } from 'react'
import { ChevronDown, CircleAlert, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none disabled:bg-surface-muted disabled:text-ink-muted'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-ink flex items-center gap-1 text-[13px] font-medium">
        {label}
        {required ? <span className="text-fail-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-fail-600 dark:text-fail-500 text-xs">{error}</p>
      ) : hint ? (
        <p className="text-ink-muted text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextInput({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(CONTROL, 'h-11', invalid && 'border-fail-500 focus:border-fail-500 focus:ring-fail-500/15', className)}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'min-h-20 py-2 leading-5', className)} {...props} />
}

export function Select({
  className,
  children,
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          CONTROL,
          'h-11 appearance-none pr-9',
          invalid && 'border-fail-500 focus:border-fail-500 focus:ring-fail-500/15',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-ink-subtle pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  )
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="accent-brand-600 border-line-strong mt-0.5 size-4 shrink-0 rounded"
        {...props}
      />
      <label htmlFor={id} className="text-ink cursor-pointer text-sm leading-5 select-none">
        {label}
        {description ? <span className="text-ink-muted block text-xs">{description}</span> : null}
      </label>
    </div>
  )
}

/** The way into a form with mistakes in it: how many there are, above the fields. */
export function ProblemCount({ count, children }: { count: number; children?: ReactNode }) {
  if (count === 0) return null
  return (
    <div role="alert">
      <span className="bg-fail-50 text-fail-700 dark:bg-fail-500/15 dark:text-fail-500 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <CircleAlert className="size-3.5" />
        Check {count} {count === 1 ? 'field' : 'fields'}
      </span>
      {children ? <p className="text-ink mt-2 text-[13px]">{children}</p> : null}
    </div>
  )
}

/** A number with a big value, nudged up and down or typed. */
export function Stepper({
  id,
  value,
  onChange,
  unit,
  step = 1,
  invalid,
  label,
}: {
  id?: string
  value: number
  onChange: (value: number) => void
  unit?: string
  step?: number
  invalid?: boolean
  /** Names the buttons, as in "Increase quantity". */
  label: string
}) {
  // What's being typed, which can be halfway to a number: "-" on the way to "-18".
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)
  const nudge = (by: number) => {
    setDraft(null)
    onChange(Number((value + by).toFixed(2)))
  }
  const button = 'text-ink flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line'
  return (
    <div
      className={cn(
        'bg-surface flex h-16 items-center gap-2 rounded-[10px] border border-line px-2.5',
        invalid && 'border-fail-500',
      )}
    >
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => nudge(-step)} className={button}>
        <Minus className="size-4" />
      </button>
      <span className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <input
          id={id}
          inputMode="decimal"
          value={shown}
          onChange={(event) => {
            const text = event.target.value
            setDraft(text)
            if (text.trim() !== '' && !Number.isNaN(Number(text))) onChange(Number(text))
          }}
          onBlur={() => setDraft(null)}
          className="text-ink min-w-0 bg-transparent text-right text-[26px] font-bold tabular-nums outline-none"
          style={{ width: `${Math.max(1, shown.length) + 0.5}ch` }}
        />
        {unit ? <span className="text-ink-muted text-xs">{unit}</span> : null}
      </span>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => nudge(step)} className={button}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

/** A setting in its own white row: what it is, what it does, and the switch. */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="bg-surface flex items-center gap-3 rounded-xl px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-semibold">{title}</p>
        <p className="text-ink-muted text-xs">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
