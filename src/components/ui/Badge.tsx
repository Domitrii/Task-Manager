import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'pass' | 'warn' | 'fail' | 'info' | 'brand'

const TONES: Record<BadgeTone, string> = {
  neutral:
    'bg-surface-muted text-ink-muted ring-line-default dark:bg-white/5 dark:text-ink-muted',
  pass: 'bg-pass-50 text-pass-700 ring-pass-500/25 dark:bg-pass-500/12 dark:text-pass-500',
  warn: 'bg-warn-50 text-warn-700 ring-warn-500/25 dark:bg-warn-500/12 dark:text-warn-500',
  fail: 'bg-fail-50 text-fail-700 ring-fail-500/25 dark:bg-fail-500/12 dark:text-fail-500',
  info: 'bg-info-50 text-info-700 ring-info-500/25 dark:bg-info-500/12 dark:text-info-500',
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/25 dark:bg-brand-500/12 dark:text-brand-300',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** A small filled circle — used in lists where a full badge would be noisy. */
export function Dot({ tone = 'neutral', className }: { tone?: BadgeTone; className?: string }) {
  const colors: Record<BadgeTone, string> = {
    neutral: 'bg-ink-subtle',
    pass: 'bg-pass-500',
    warn: 'bg-warn-500',
    fail: 'bg-fail-500',
    info: 'bg-info-500',
    brand: 'bg-brand-500',
  }
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', colors[tone], className)} />
}
