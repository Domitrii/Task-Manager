import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import type { DayCompletion } from '@/data/selectors'
import { cn } from '@/lib/utils'
import { Dot } from '@/components/ui/Badge'

/** The same thresholds the reports use: 95% is a good day, under 80% a bad one. */
function rateFill(rate: number): string {
  if (rate >= 95) return 'bg-pass-500'
  if (rate >= 80) return 'bg-warn-500'
  return 'bg-fail-500'
}

/**
 * One column per day, filled to the share of scheduled checks done. The number
 * is printed under every column, so the colour only ever backs it up.
 */
export function WeekStrip({ days }: { days: DayCompletion[] }) {
  return (
    <section aria-labelledby="week-strip">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-strip" className="text-ink text-[17px] font-bold">
          Last 7 days
        </h2>
        <Link to="/reports" className="text-brand-700 dark:text-brand-300 text-sm font-semibold hover:underline">
          Reports
        </Link>
      </div>
      <p className="text-ink-muted mt-0.5 text-sm">Share of scheduled checks done each day</p>

      <ol className="bg-surface border-line mt-3 grid grid-cols-7 gap-1.5 rounded-xl border p-3">
        {days.map((day) => (
          <li
            key={day.date}
            className="flex flex-col items-center gap-1.5"
            title={
              day.rate === null
                ? `${format(day.day, 'EEEE d MMM')}: nothing scheduled`
                : `${format(day.day, 'EEEE d MMM')}: ${day.done} of ${day.required} done${day.isToday ? ' so far' : ''}`
            }
          >
            <span className="bg-surface-muted dark:bg-line relative flex h-20 w-full max-w-7 items-end overflow-hidden rounded-md">
              {day.rate !== null ? (
                <span
                  className={cn('w-full rounded-t-[4px]', rateFill(day.rate))}
                  style={{ height: `${Math.max(day.rate, 4)}%` }}
                />
              ) : null}
            </span>
            <span className="text-ink text-[13px] font-bold">{day.rate === null ? '—' : `${day.rate}%`}</span>
            <span className={cn('text-xs', day.isToday ? 'text-ink font-semibold' : 'text-ink-muted')}>
              {day.isToday ? 'Today' : format(day.day, 'EEE')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export interface GlanceRow {
  label: string
  detail?: string
  value: number
  to: string
  /** Set when a non-zero value means someone should look. */
  attention?: 'fail' | 'warn'
}

export function AtAGlance({ rows, action }: { rows: GlanceRow[]; action?: ReactNode }) {
  return (
    <section aria-labelledby="at-a-glance">
      <h2 id="at-a-glance" className="text-ink text-[17px] font-bold">
        At a glance
      </h2>
      <ul className="bg-surface border-line divide-line mt-3 divide-y overflow-hidden rounded-xl border">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to={row.to}
              className="hover:bg-surface-muted/60 flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="text-ink block text-[15px] font-medium">{row.label}</span>
                {row.detail ? <span className="text-ink-muted block text-[13px]">{row.detail}</span> : null}
              </span>
              {row.attention && row.value > 0 ? <Dot tone={row.attention} className="size-2.5" /> : null}
              <span className="text-ink text-lg font-bold">{row.value}</span>
              <ChevronRight className="text-ink-subtle size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {action}
    </section>
  )
}
