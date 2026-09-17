import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { BadgeTone } from '@/components/ui/Badge'

const ACCENTS: Record<BadgeTone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-surface-muted text-ink-muted', value: 'text-ink' },
  brand: { icon: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300', value: 'text-ink' },
  pass: { icon: 'bg-pass-50 text-pass-600 dark:bg-pass-500/12 dark:text-pass-500', value: 'text-ink' },
  warn: { icon: 'bg-warn-50 text-warn-600 dark:bg-warn-500/12 dark:text-warn-500', value: 'text-warn-600 dark:text-warn-500' },
  fail: { icon: 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500', value: 'text-fail-600 dark:text-fail-500' },
  info: { icon: 'bg-info-50 text-info-600 dark:bg-info-500/12 dark:text-info-500', value: 'text-ink' },
}

/**
 * KPI tile. `tone` is meaningful, not decorative — it only turns amber/red when
 * the number itself represents something that needs attention.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'neutral',
  to,
}: {
  label: string
  value: ReactNode
  sublabel?: ReactNode
  icon?: ReactNode
  tone?: BadgeTone
  to?: string
}) {
  const accent = ACCENTS[tone]
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-muted text-xs font-medium sm:text-[13px]">{label}</p>
        {icon ? (
          <span className={cn('flex size-8 items-center justify-center rounded-lg', accent.icon)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn('tabular mt-1.5 text-xl leading-7 font-semibold sm:mt-2 sm:text-2xl sm:leading-8', accent.value)}>{value}</p>
      {sublabel ? <p className="text-ink-muted mt-1 text-xs">{sublabel}</p> : null}
    </>
  )

  const className = cn(
    'bg-surface border-line rounded-card block border p-3.5 shadow-card transition-colors sm:p-4',
    to && 'hover:border-line-strong hover:bg-surface-muted/40',
  )

  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}
