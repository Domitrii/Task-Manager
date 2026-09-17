import { NavLink, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { NAVIGATION, type NavBadge, type NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/Button'
import { Logo } from './Logo'

export interface SidebarCounters {
  overdueChecks: number
  openIssues: number
  openTasks: number
  rejectedDeliveries: number
}

function Counter({ value, tone }: { value: number; tone: 'fail' | 'warn' | 'neutral' }) {
  if (value <= 0) return null
  return (
    <span
      className={cn(
        'ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums',
        tone === 'fail' && 'bg-fail-500 text-white',
        tone === 'warn' && 'bg-warn-500 text-slate-950',
        tone === 'neutral' && 'bg-white/10 text-sidebar-fg',
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

const BADGE_TONE: Record<NavBadge, 'fail' | 'warn' | 'neutral'> = {
  overdueChecks: 'fail',
  openIssues: 'fail',
  rejectedDeliveries: 'warn',
  openTasks: 'neutral',
}

function NavRow({
  item,
  counters,
  onNavigate,
  nested = false,
}: {
  item: NavItem
  counters: SidebarCounters
  onNavigate: () => void
  nested?: boolean
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
          nested ? 'ml-3 py-1.5 text-[13px]' : '',
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-sidebar-fg hover:bg-white/6 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'shrink-0 transition-colors',
              nested ? 'size-4' : 'size-4.5',
              isActive ? 'text-brand-300' : 'text-sidebar-fg-muted group-hover:text-sidebar-fg',
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <Counter value={counters[item.badge]} tone={BADGE_TONE[item.badge]} />
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export function SidebarContent({
  counters,
  onNavigate,
  onClose,
}: {
  counters: SidebarCounters
  onNavigate: () => void
  onClose?: () => void
}) {
  const location = useLocation()

  return (
    <div className="bg-sidebar flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Logo />
        {onClose ? (
          <IconButton
            label="Close navigation"
            size="sm"
            onClick={onClose}
            className="text-sidebar-fg hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </IconButton>
        ) : null}
      </div>

      <nav className="scrollbar-none flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAVIGATION.map((section) => (
          <div key={section.title}>
            <p className="text-sidebar-fg-muted px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                // Child routes stay expanded while anywhere in that branch.
                const branchActive = location.pathname.startsWith(item.to) && item.to !== '/'
                return (
                  <div key={item.to} className="space-y-0.5">
                    <NavRow item={item} counters={counters} onNavigate={onNavigate} />
                    {item.children && branchActive
                      ? item.children.map((child) => (
                          <NavRow
                            key={child.to}
                            item={child}
                            counters={counters}
                            onNavigate={onNavigate}
                            nested
                          />
                        ))
                      : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/8 px-4 py-3">
        <p className="text-sidebar-fg-muted text-[11px] leading-4">
          Demo data · all records entered manually
        </p>
      </div>
    </div>
  )
}
