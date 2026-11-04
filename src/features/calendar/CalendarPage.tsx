import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import { CalendarOff, CalendarX, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react'
import {
  currentShift,
  shiftsFor,
  shiftsOn,
  shiftState,
  unavailabilityOn,
  weekDays,
  weekLabel,
} from '@/data/shifts'
import { useStore } from '@/data/store'
import { toISODate } from '@/lib/compliance'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Banner } from '@/components/ui/Banner'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChipTabs } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { useIsManager } from '@/features/temperatures/access'
import { AddShiftModal } from './AddShiftModal'
import { AddUnavailabilityModal } from './AddUnavailabilityModal'
import { ClockBar, ClockStatusCard, longDate, ShiftCard, UnavailabilityCard, useClockOffline } from './parts'

type Tab = 'calendar' | 'list'
type Notice = 'unavailability' | 'clocked-out'

const NOTICES: Record<Notice, string> = {
  unavailability: 'Unavailability saved',
  'clocked-out': 'Clocked out',
}

/** Someone's own week: when they're on, clocking in and out, and when they can't work. */
export function CalendarPage() {
  const now = useNow()
  const navigate = useNavigate()
  const { data, activeStaffId } = useStore()
  const manager = useIsManager()
  const { offline, lastSynced } = useClockOffline()
  const [tab, setTab] = useState<Tab>('calendar')
  const today = toISODate(now)
  const [monday, setMonday] = useState(() => startOfWeek(now, { weekStartsOn: 1 }))
  const [selected, setSelected] = useState(today)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<'unavailability' | 'shift' | null>(null)

  const shift = useMemo(() => currentShift(data, activeStaffId, now), [data, activeStaffId, now])
  const state = shift ? shiftState(shift) : null

  const upcoming = useMemo(() => {
    const shifts = shiftsFor(data, activeStaffId).filter((entry) => entry.date >= today)
    const away = data.unavailability.filter((entry) => entry.staffId === activeStaffId && entry.endDate >= today)
    const dates = [...new Set([...shifts.map((entry) => entry.date), ...away.map((entry) => entry.startDate)])].sort()
    return { dates, away, shifts }
  }, [data, activeStaffId, today])
  const nothing = upcoming.dates.length === 0 && !shift

  const days = weekDays(monday)
  const dayShifts = shiftsOn(data, activeStaffId, selected)
  const dayAway = unavailabilityOn(data, activeStaffId, selected)
  const anyAway = days.some((day) => unavailabilityOn(data, activeStaffId, toISODate(day)))

  const addButton = (
    <Button block onClick={() => setDialog('unavailability')}>
      Add unavailability
    </Button>
  )

  return (
    <div className="space-y-3.5 pb-16 lg:pb-0">
      <PageHeader title="Calendar" onBack={() => navigate('/')} />

      {notice ? <Banner tone="pass" title={NOTICES[notice]} /> : null}
      {offline ? (
        <Banner tone="warn" title={`Offline${lastSynced ? ` · Last synced ${lastSynced}` : ''}`}>
          Cached shifts are available to view. Reconnect to use clock actions.
        </Banner>
      ) : null}

      <ChipTabs
        stretch
        label="Calendar view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'list', label: 'List' },
        ]}
      />

      <p className="text-ink-muted text-[13px]">
        Today · {longDate(today)}
        {state === 'scheduled' && shift?.date === today ? ` · Before shift, ${format(now, 'HH:mm')}` : ''}
      </p>

      {shift ? <ClockStatusCard shift={shift} now={now} /> : null}

      {nothing ? (
        <>
          <EmptyState
            icon={<CalendarX className="size-5" />}
            title="No shifts scheduled"
            description="You have no upcoming shifts in this schedule. Add unavailability to record when you’re not available."
            className="py-8"
          />
          {addButton}
        </>
      ) : (
        <>
          {addButton}
          {tab === 'calendar' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-ink text-lg font-bold">{weekLabel(monday)}</h2>
                <div className="flex shrink-0">
                  <IconButton label="Previous week" size="sm" onClick={() => setMonday((week) => addWeeks(week, -1))}>
                    <ChevronLeft className="size-4" />
                  </IconButton>
                  <IconButton label="Next week" size="sm" onClick={() => setMonday((week) => addWeeks(week, 1))}>
                    <ChevronRight className="size-4" />
                  </IconButton>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {days.map((day) => {
                  const date = toISODate(day)
                  const working = shiftsOn(data, activeStaffId, date).length > 0
                  const away = unavailabilityOn(data, activeStaffId, date)
                  return (
                    <button
                      key={date}
                      type="button"
                      aria-pressed={date === selected}
                      onClick={() => setSelected(date)}
                      className={cn(
                        'flex min-h-14 flex-col items-center justify-center rounded-[10px] border px-1 py-1.5 text-center transition-colors',
                        date === selected
                          ? 'border-brand-400 bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                          : 'bg-surface text-ink border-transparent',
                      )}
                    >
                      <span className={cn('text-xs', date === today ? 'font-bold' : 'font-medium')}>
                        {format(day, 'EEE d')}
                      </span>
                      <span className="text-ink-muted mt-0.5 flex items-center gap-1 text-[11px]">
                        {working ? (
                          <>
                            <Users className="size-3" /> Shift
                          </>
                        ) : away ? (
                          <>
                            <CalendarOff className="size-3" /> {away.allDay ? 'All day' : 'Part'}
                          </>
                        ) : (
                          'Off'
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              <p className="text-ink-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span className="flex items-center gap-1">
                  <Users className="size-3" /> Assigned shift
                </span>
                {anyAway ? (
                  <span className="flex items-center gap-1">
                    <CalendarOff className="size-3" /> Unavailability
                  </span>
                ) : null}
              </p>

              <section aria-label={format(parseISO(selected), 'EEEE d MMMM')} className="space-y-2.5">
                <h2 className="text-ink text-sm font-semibold">{longDate(selected)}</h2>
                {dayShifts.map((entry) => (
                  <ShiftCard key={entry.id} shift={entry} />
                ))}
                {dayAway ? <UnavailabilityCard entry={dayAway} /> : null}
                {dayShifts.length === 0 && !dayAway ? <p className="text-ink-muted text-[13px]">Off</p> : null}
              </section>
            </>
          ) : (
            <div className="space-y-4">
              {upcoming.dates.slice(0, 14).map((date) => (
                <section key={date} aria-label={longDate(date)} className="space-y-2">
                  <h2 className="text-ink text-sm font-semibold">{longDate(date)}</h2>
                  {upcoming.shifts
                    .filter((entry) => entry.date === date)
                    .map((entry) => (
                      <ShiftCard key={entry.id} shift={entry} />
                    ))}
                  {upcoming.away
                    .filter((entry) => entry.startDate === date)
                    .map((entry) => (
                      <UnavailabilityCard key={entry.id} entry={entry} />
                    ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {manager ? (
        <Button variant="ghost" size="sm" onClick={() => setDialog('shift')} className="gap-1.5">
          <Plus className="size-4" />
          Add shift
        </Button>
      ) : null}

      <ClockBar shift={shift} now={now} onClockedOut={() => setNotice('clocked-out')} />

      {dialog === 'unavailability' ? (
        <AddUnavailabilityModal
          date={selected < today ? today : selected}
          onClose={() => setDialog(null)}
          onSaved={() => setNotice('unavailability')}
        />
      ) : null}
      {dialog === 'shift' ? (
        <AddShiftModal date={selected < today ? today : selected} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  )
}
