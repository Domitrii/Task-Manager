import { Link, useLocation } from 'react-router-dom'
import { Bell, Calendar, Plus, Search } from 'lucide-react'
import { DayProgressBar } from './DayProgress'
import type { HeaderProgress } from './headerProgress'
import { LogoMark } from './Logo'
import { ProfileMenu } from './ProfileMenu'

const ICON_LINK = 'flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10'

/** The band along the top of every page: where you are, what's waiting, and how the day is going. */
export function Topbar({
  ownProgress,
  alertCount,
  onOpenSearch,
  onOpenLog,
}: {
  ownProgress: HeaderProgress | null
  alertCount: number
  onOpenSearch: () => void
  onOpenLog: () => void
}) {
  const location = useLocation()
  // These are about someone's own week and reminders, not how today's list is going.
  const showProgress = !['/calendar', '/notifications'].some((path) => location.pathname.startsWith(path))

  return (
    <header className="bg-header sticky top-0 z-30 shrink-0 pt-[env(safe-area-inset-top)] text-white">
      <div className="flex h-16 items-center gap-1 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 lg:hidden" aria-label="Home">
          <LogoMark inverse className="size-7 rounded-md" />
          <span className="font-display text-xl">Mise</span>
        </Link>

        <div className="hidden flex-1 lg:block">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-10 w-full max-w-sm items-center gap-2.5 rounded-[10px] border border-white/20 bg-white/10 px-3 text-sm text-white/85 transition-colors hover:bg-white/15"
          >
            <Search className="size-4" />
            <span>Search equipment, pages or actions</span>
            <kbd className="ml-auto rounded border border-white/25 px-1.5 py-0.5 font-sans text-[11px] font-medium text-white/75">
              ⌘K
            </kbd>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenLog}
          className="text-brand-700 hover:bg-brand-50 mr-2 hidden h-10 items-center gap-1.5 rounded-[10px] bg-white pr-5 pl-4 text-sm font-semibold transition-colors lg:inline-flex"
        >
          <Plus className="size-4.5" strokeWidth={2.5} />
          Log
        </button>

        <Link to="/calendar" aria-label="Calendar" className={ICON_LINK}>
          <Calendar className="size-5" strokeWidth={1.8} />
        </Link>

        <Link
          to="/notifications"
          aria-label={alertCount > 0 ? `Notifications: ${alertCount} unread` : 'Notifications'}
          className={`${ICON_LINK} relative`}
        >
          <Bell className="size-5" strokeWidth={1.8} />
          {alertCount > 0 ? (
            <span className="text-brand-800 absolute top-0 right-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold tabular-nums">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          ) : null}
        </Link>

        <ProfileMenu />
      </div>

      {showProgress ? <DayProgressBar own={ownProgress} /> : null}
    </header>
  )
}
