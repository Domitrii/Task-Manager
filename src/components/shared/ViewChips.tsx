import { NavLink } from 'react-router-dom'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { chipClass } from '@/components/ui/Tabs'

/** Sibling views of one section, as a scrollable row of chips under the page title. */
export function ViewChips({ views, label }: { views: NavItem[]; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {views.map((view) => (
        <NavLink
          key={view.to}
          to={view.to}
          end={view.end}
          className={({ isActive }) => cn(chipClass(isActive), 'shrink-0')}
        >
          {view.label}
        </NavLink>
      ))}
    </nav>
  )
}
