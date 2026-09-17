import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabOption<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

/** Horizontal tab bar. Scrolls rather than wraps so the row height stays fixed. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('border-line scrollbar-none -mb-px flex gap-1 overflow-x-auto border-b', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                : 'text-ink-muted hover:text-ink border-transparent',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  'ml-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums',
                  active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-200' : 'bg-surface-muted text-ink-muted',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Compact pill group for filters that sit inside a card header. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-surface-muted border-line inline-flex gap-0.5 rounded-lg border p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[6px] px-2.5 py-1 text-[13px] font-medium whitespace-nowrap transition-colors',
            option.value === value
              ? 'bg-surface text-ink shadow-xs'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
