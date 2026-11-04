import { NavLink, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, Plus } from 'lucide-react'
import { PRIMARY_NAV, RECORD_NAV, SETTINGS_NAV, TEAM_NAV, TEMPLATES_NAV, type NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'

const TAB = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-medium'

const tabClass = (active: boolean) => cn(TAB, active ? 'text-brand-600 dark:text-brand-300' : 'text-ink-muted')

/** Pages opened from the top band, which belong to Home. */
const UNDER_HOME = ['/calendar', '/notifications']
/** Everything reached through More. */
const UNDER_MORE = ['/more', '/profile', ...[...RECORD_NAV, TEAM_NAV, TEMPLATES_NAV, SETTINGS_NAV].map((item) => item.to)]

function Tab({ item, active }: { item: NavItem; active?: boolean }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => tabClass(isActive || Boolean(active))}>
      <Icon className="size-6" strokeWidth={1.7} />
      {item.label}
    </NavLink>
  )
}

/**
 * Phone navigation: Home and Checklist, the Log button in the thumb's natural
 * resting place, then Reports and everything else.
 */
export function BottomNav({ onOpenLog }: { onOpenLog: () => void }) {
  const { pathname } = useLocation()
  const within = (paths: string[]) => paths.some((path) => pathname.startsWith(path))
  const [home, checklist, reports] = PRIMARY_NAV

  return (
    <nav
      aria-label="Main"
      className="bg-app/95 border-line fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        <Tab item={home} active={within(UNDER_HOME)} />
        <Tab item={checklist} />
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onOpenLog}
            aria-label="Log something"
            className="bg-brand-600 active:bg-brand-800 shadow-raised flex size-[3.25rem] items-center justify-center rounded-[14px] text-white"
          >
            <Plus className="size-7" strokeWidth={2} />
          </button>
        </div>
        <Tab item={reports} />
        <Tab item={{ label: 'More', to: '/more', icon: MenuIcon }} active={within(UNDER_MORE)} />
      </div>
    </nav>
  )
}
