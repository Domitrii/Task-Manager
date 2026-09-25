import { NavLink } from 'react-router-dom'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'

/** Sibling views of one section, as a scrollable row of chips under the page title. */
export function ViewChips({ views, label }: { views: NavItem[]; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {views.map((view) => (
        <NavLink
          key={view.to}
          to={view.to}
          end={view.end}
          className={({ isActive }) =>
            cn(
              'flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
              isActive
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line-default bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
            )
          }
        >
          {view.label}
        </NavLink>
      ))}
    </nav>
  )
}
