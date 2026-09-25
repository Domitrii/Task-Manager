import { NavLink } from 'react-router-dom'
import { PRIMARY_NAV, RECORD_NAV, SETTINGS_NAV, type NavBadge, type NavItem } from '@/config/navigation'
import { useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

export type CounterTone = 'fail' | 'warn' | 'neutral'
export type NavCounters = Record<NavBadge, { value: number; tone: CounterTone }>

export function Counter({ value, tone, className }: { value: number; tone: CounterTone; className?: string }) {
  if (value <= 0) return null
  return (
    <span
      className={cn(
        'min-w-5 rounded-full px-1.5 py-px text-center text-[11px] leading-4 font-bold tabular-nums',
        tone === 'fail' && 'bg-fail-600 text-white',
        tone === 'warn' && 'bg-warn-500 text-slate-950',
        tone === 'neutral' && 'bg-surface-muted text-ink-muted',
        className,
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

function NavRow({ item, counters }: { item: NavItem; counters: NavCounters }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/12 dark:text-brand-200'
            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'size-[18px] shrink-0',
              isActive ? 'text-brand-600 dark:text-brand-300' : 'text-ink-subtle group-hover:text-ink-muted',
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge ? <Counter className="ml-auto" {...counters[item.badge]} /> : null}
        </>
      )}
    </NavLink>
  )
}

/** Desktop navigation. Phones get the bottom tab bar instead. */
export function Sidebar({ counters }: { counters: NavCounters }) {
  const { data } = useStore()
  return (
    <div className="bg-surface border-line flex h-full flex-col border-r">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo venue={data.settings.venueName} />
      </div>

      <nav aria-label="Main" className="scrollbar-none flex-1 overflow-y-auto px-3 pt-2 pb-6">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavRow key={item.to} item={item} counters={counters} />
          ))}
        </div>

        <p className="text-ink-subtle mt-7 mb-1.5 px-3 text-[13px] font-medium">Records</p>
        <div className="space-y-0.5">
          {RECORD_NAV.map((item) => (
            <NavRow key={item.to} item={item} counters={counters} />
          ))}
        </div>
      </nav>

      <div className="border-line border-t px-3 py-3">
        <NavRow item={SETTINGS_NAV} counters={counters} />
      </div>
    </div>
  )
}
