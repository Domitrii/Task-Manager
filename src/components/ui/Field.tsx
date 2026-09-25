import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full rounded-lg border border-line-default bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none disabled:bg-surface-muted disabled:text-ink-muted'

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
        <p className="text-fail-600 text-xs">{error}</p>
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
      className={cn(CONTROL, 'h-10', invalid && 'border-fail-500 focus:border-fail-500 focus:ring-fail-500/15', className)}
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
          'h-10 appearance-none pr-9',
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
