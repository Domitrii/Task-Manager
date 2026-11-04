import { useMemo } from 'react'
import { Moon, Sun } from 'lucide-react'
import { RECORD_NAV, SETTINGS_NAV, TEAM_NAV, TEMPLATES_NAV, type NavItem } from '@/config/navigation'
import { selectProbeCalibration } from '@/data/attention'
import { selectChecklistStatus, selectLowStock, selectOrdersToCheckIn } from '@/data/selectors'
import { shiftState } from '@/data/shifts'
import { useStore } from '@/data/store'
import { toISODate } from '@/lib/compliance'
import { useTheme } from '@/lib/theme'
import { useNow } from '@/lib/useNow'
import { Toggle } from '@/components/ui/Field'
import { ListCard, Overline } from '@/components/shared/ListCard'
import { isApplianceItem } from '@/features/temperatures/thresholds'

const count = (value: number, one: string, many = `${one}s`) => `${value} ${value === 1 ? one : many}`

/** Every other part of the app, with where each stands. */
export function MorePage() {
  const now = useNow()
  const { data } = useStore()
  const { theme, toggle } = useTheme()

  const details = useMemo<Record<string, string>>(() => {
    const appliances = data.items.filter((item) => item.active && isApplianceItem(item))
    const outOfRange = appliances.filter(
      (item) => data.temperatureLogs.find((log) => log.itemId === item.id)?.outcome === 'fail',
    ).length
    const orders = selectOrdersToCheckIn(data, now)
    const open = data.issues.filter((issue) => issue.status !== 'resolved').length
    const signOff = data.issues.filter((issue) => issue.needsSignOff).length
    const low = selectLowStock(data).length
    const calibration = selectProbeCalibration(data, now)
    const today = toISODate(now)
    const staff = data.staff.filter((person) => person.active).length
    const clockedIn = data.shifts.filter((shift) => shift.date === today && shiftState(shift) === 'clocked-in').length
    const checklists = selectChecklistStatus(data, now)

    return {
      '/temperatures': [outOfRange > 0 ? `${outOfRange} out of range` : null, count(appliances.length, 'appliance')]
        .filter(Boolean)
        .join(' · '),
      '/food-probe': calibration.needed ? 'Calibration needs check' : 'Calibration up to date',
      '/deliveries': `${orders.due.length + orders.overdue.length} expected today`,
      '/suppliers': count(data.suppliers.filter((entry) => entry.active).length, 'supplier'),
      '/food-safety': [`${open} open`, signOff > 0 ? `${signOff} needs sign-off` : null].filter(Boolean).join(' · '),
      '/stock': low > 0 ? `${count(low, 'item')} low in stock` : 'Nothing low in stock',
      '/checklists': `${checklists.filter((entry) => entry.run).length} of ${checklists.length} signed off today`,
      '/templates': count(data.taskTemplates.length, 'saved template'),
      '/team': `${count(staff, 'person', 'people')} · ${clockedIn} clocked in`,
      '/settings': 'Account, notifications, sync and help',
    }
  }, [data, now])

  const row = (item: NavItem) => (
    <li key={item.to}>
      <ListCard to={item.to} icon={item.icon} title={item.label} subtitle={details[item.to]} />
    </li>
  )

  return (
    <div className="space-y-5">
      <h1 className="font-display text-ink text-[28px] leading-tight font-bold">More</h1>
      <section>
        <Overline>Operations</Overline>
        <ul className="space-y-2.5">{RECORD_NAV.map(row)}</ul>
      </section>
      <section>
        <Overline>Admin</Overline>
        <ul className="space-y-2.5">
          {[TEAM_NAV, TEMPLATES_NAV, SETTINGS_NAV].map(row)}
          <li className="bg-surface shadow-card rounded-card flex items-center gap-3 p-3.5">
            {theme === 'dark' ? <Sun className="text-ink-muted size-5" /> : <Moon className="text-ink-muted size-5" />}
            <span className="text-ink flex-1 text-[15px] font-semibold">Dark mode</span>
            <Toggle checked={theme === 'dark'} onChange={toggle} label="Dark mode" />
          </li>
        </ul>
      </section>
    </div>
  )
}
