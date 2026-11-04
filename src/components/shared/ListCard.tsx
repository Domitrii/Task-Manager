import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'

/** One thing in a list, leading to its own page. */
export function ListCard({
  to,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  to: string
  icon?: LucideIcon
  title: ReactNode
  subtitle?: ReactNode
  /** Goes under the title: status pills and notes. */
  children?: ReactNode
}) {
  return (
    <Link to={to} className="bg-surface shadow-card rounded-card block p-3.5">
      <span className="flex items-center gap-3">
        {Icon ? <Icon className="text-ink-muted size-5 shrink-0" strokeWidth={1.8} /> : null}
        <span className="min-w-0 flex-1">
          <span className="text-ink block text-[15px] leading-snug font-semibold">{title}</span>
          {subtitle ? <span className="text-ink-muted mt-0.5 block text-[13px]">{subtitle}</span> : null}
        </span>
        <ChevronRight className="text-ink-muted size-5 shrink-0" />
      </span>
      {children ? <span className="mt-2 block">{children}</span> : null}
    </Link>
  )
}

/** A small capitalised label over a group of rows. */
export function Overline({ children }: { children: ReactNode }) {
  return <h2 className="text-ink-muted mb-2 text-[11px] font-semibold tracking-wider uppercase">{children}</h2>
}

/** A white block of labelled detail on a detail page. */
export function InfoCard({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-surface shadow-card rounded-card p-4">
      {title ? (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <h2 className="text-ink text-[15px] font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="text-ink-muted space-y-1 text-[13px]">{children}</div>
    </section>
  )
}
