import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, Menu as MenuIcon, Moon, Plus, Sun } from 'lucide-react'
import { PRIMARY_NAV, RECORD_NAV, SETTINGS_NAV, type NavItem } from '@/config/navigation'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Counter, type NavCounters } from './Sidebar'

const TAB = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-semibold'

function Tab({ item, counters }: { item: NavItem; counters: NavCounters }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(TAB, isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-muted')
      }
    >
      <span className="relative">
        <Icon className="size-6" strokeWidth={1.9} />
        {item.badge ? (
          <Counter {...counters[item.badge]} className="absolute -top-1.5 left-4 ring-2 ring-[var(--surface)]" />
        ) : null}
      </span>
      {item.label}
    </NavLink>
  )
}

/**
 * Phone navigation: Today and Tasks, the Log button in the thumb's natural
 * resting place, then Reports and everything else.
 */
export function BottomNav({
  counters,
  onOpenLog,
  onOpenMore,
}: {
  counters: NavCounters
  onOpenLog: () => void
  onOpenMore: () => void
}) {
  const location = useLocation()
  const inMore = [...RECORD_NAV, SETTINGS_NAV].some((item) => location.pathname.startsWith(item.to))
  const [today, tasks, reports] = PRIMARY_NAV

  return (
    <nav
      aria-label="Main"
      className="bg-surface/95 border-line fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        <Tab item={today} counters={counters} />
        <Tab item={tasks} counters={counters} />
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onOpenLog}
            aria-label="Log something"
            className="bg-brand-600 active:bg-brand-800 shadow-raised flex size-14 -translate-y-3 items-center justify-center rounded-2xl text-white"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>
        <Tab item={reports} counters={counters} />
        <button
          type="button"
          onClick={onOpenMore}
          className={cn(TAB, inMore ? 'text-brand-700 dark:text-brand-300' : 'text-ink-muted')}
        >
          <MenuIcon className="size-6" strokeWidth={1.9} />
          More
        </button>
      </div>
    </nav>
  )
}

export function MoreSheet({ counters, onClose }: { counters: NavCounters; onClose: () => void }) {
  const { theme, toggle } = useTheme()
  const rows = [...RECORD_NAV, SETTINGS_NAV]

  return (
    <Modal open onClose={onClose} title="More">
      <ul className="-mx-2 -mt-1">
        {rows.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex h-14 items-center gap-3.5 rounded-lg px-3 text-base font-medium',
                    isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/12 dark:text-brand-200' : 'text-ink',
                  )
                }
              >
                <Icon className="text-ink-muted size-5" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? <Counter {...counters[item.badge]} /> : null}
                <ChevronRight className="text-ink-subtle size-4" />
              </NavLink>
            </li>
          )
        })}
        <li className="border-line mt-1 border-t pt-1">
          <button
            type="button"
            onClick={toggle}
            className="text-ink flex h-14 w-full items-center gap-3.5 rounded-lg px-3 text-base font-medium"
          >
            {theme === 'dark' ? <Sun className="text-ink-muted size-5" /> : <Moon className="text-ink-muted size-5" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </li>
      </ul>
    </Modal>
  )
}
