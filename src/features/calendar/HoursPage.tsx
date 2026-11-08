import { useMemo, useState } from 'react'
import { addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { breakMs, shiftWindow, weekDays, weekLabel, workedMs } from '@/data/shifts'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ID, Shift } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { downloadCsv } from '@/lib/csv'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { useIsManager } from '@/features/temperatures/access'

const minutes = (ms: number) => Math.round(ms / 60_000)

/** "7h 30", or "45m". */
function hours(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m}m`
}

interface Row {
  staffId: ID
  shifts: Shift[]
  scheduled: number
  worked: number
  breaks: number
  /** Clocked in and not out yet: the total is still growing, or End shift was forgotten. */
  open: number
  corrected: number
  /** Clocked in with no shift on the schedule. */
  extra: number
}

/**
 * Hours for a week, from the clock: what was planned, what was worked and how
 * long the breaks were. Managers see everyone and can export it for payroll;
 * everyone else sees their own.
 */
export function HoursPage() {
  const now = useNow()
  const { data, activeStaff } = useStore()
  const manager = useIsManager()
  const toast = useToast()
  const goBack = useGoBack('/calendar')
  const [monday, setMonday] = useState(() => startOfWeek(now, { weekStartsOn: 1 }))

  const firstDay = toISODate(monday)
  const rows = useMemo<Row[]>(() => {
    const days = weekDays(monday).map(toISODate)
    const week = data.shifts.filter((shift) => shift.date >= days[0] && shift.date <= days[6])
    const people = new Map<ID, Row>()
    for (const shift of week) {
      if (!manager && shift.staffId !== activeStaff.id) continue
      const row = people.get(shift.staffId) ?? {
        staffId: shift.staffId,
        shifts: [],
        scheduled: 0,
        worked: 0,
        breaks: 0,
        open: 0,
        corrected: 0,
        extra: 0,
      }
      const { start, end } = shiftWindow(shift)
      row.shifts.push(shift)
      // An extra shift was never planned, so none of it counts as scheduled.
      if (shift.unscheduled) row.extra += 1
      else row.scheduled += minutes(end.getTime() - start.getTime())
      row.worked += minutes(workedMs(shift, now))
      row.breaks += minutes(breakMs(shift, now))
      if (shift.clockedInAt && !shift.clockedOutAt) row.open += 1
      if (shift.timeCorrections?.length) row.corrected += 1
      people.set(shift.staffId, row)
    }
    return [...people.values()].sort((a, b) => staffName(data, a.staffId).localeCompare(staffName(data, b.staffId)))
  }, [data, monday, now, manager, activeStaff.id])

  const total = rows.reduce((sum, row) => ({ scheduled: sum.scheduled + row.scheduled, worked: sum.worked + row.worked }), {
    scheduled: 0,
    worked: 0,
  })

  function exportWeek() {
    const shifts = rows.flatMap((row) => row.shifts).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    downloadCsv(
      `hours-${firstDay}.csv`,
      shifts.map((shift) => {
        const corrections = shift.timeCorrections ?? []
        return {
          Date: shift.date,
          Name: staffName(data, shift.staffId),
          'On the schedule': shift.unscheduled ? 'No (extra shift)' : 'Yes',
          'Scheduled start': shift.unscheduled ? '' : shift.startTime,
          'Scheduled end': shift.unscheduled ? '' : shift.endTime,
          'Clocked in': shift.clockedInAt ? format(parseISO(shift.clockedInAt), 'yyyy-MM-dd HH:mm') : '',
          'Clocked out': shift.clockedOutAt ? format(parseISO(shift.clockedOutAt), 'yyyy-MM-dd HH:mm') : '',
          'Clocked out by': shift.clockedOutBy ? staffName(data, shift.clockedOutBy) : '',
          'Break (minutes)': minutes(breakMs(shift, now)),
          'Worked (minutes)': minutes(workedMs(shift, now)),
          'Still clocked in': shift.clockedInAt && !shift.clockedOutAt ? 'Yes' : '',
          'Times corrected': corrections.map((entry) => `${staffName(data, entry.by)}: ${entry.reason}`).join('; '),
        }
      }),
    )
    toast.success('Hours exported', `${shifts.length} ${shifts.length === 1 ? 'shift' : 'shifts'} downloaded as CSV.`)
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        title={manager ? 'Hours worked' : 'Your hours'}
        onBack={goBack}
        actions={
          manager && rows.length > 0 ? (
            <Button size="sm" onClick={exportWeek} className="gap-1.5">
              <Download className="size-4" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center justify-between gap-2">
        <IconButton label="Previous week" variant="secondary" onClick={() => setMonday(addWeeks(monday, -1))}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <h2 className="font-display text-ink text-center text-lg font-bold">{weekLabel(monday)}</h2>
        <IconButton label="Next week" variant="secondary" onClick={() => setMonday(addWeeks(monday, 1))}>
          <ChevronRight className="size-5" />
        </IconButton>
      </div>

      <p className="text-ink-muted text-[13px]">
        Worked is from clocking in to clocking out, less breaks. A shift still clocked in counts up to now.
        {manager ? ' Open a shift on the calendar to correct its times.' : ''}
      </p>

      {rows.length === 0 ? (
        <EmptyState title="No shifts this week" description="Shifts on the schedule show here with their hours." />
      ) : (
        <ul className="bg-surface border-line divide-line divide-y rounded-xl border">
          {rows.map((row) => (
            <li key={row.staffId} className="px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-ink truncate text-sm font-semibold">{staffName(data, row.staffId)}</p>
                <p className="text-ink text-sm font-semibold tabular-nums">{hours(row.worked)}</p>
              </div>
              <p className="text-ink-muted text-xs">
                {row.shifts.length} {row.shifts.length === 1 ? 'shift' : 'shifts'} · {hours(row.scheduled)} scheduled ·{' '}
                {hours(row.breaks)} on break
              </p>
              {row.open > 0 || row.corrected > 0 || row.extra > 0 ? (
                <p className="text-warn-700 dark:text-warn-500 text-xs">
                  {[
                    row.open > 0 ? `${row.open} still clocked in` : null,
                    row.extra > 0 ? `${row.extra} extra ${row.extra === 1 ? 'shift' : 'shifts'}` : null,
                    row.corrected > 0 ? `${row.corrected} with corrected times` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
          {manager && rows.length > 1 ? (
            <li className="flex items-baseline justify-between gap-3 px-3.5 py-3">
              <p className="text-ink text-sm font-semibold">Everyone</p>
              <p className="text-ink-muted text-xs">
                <span className="text-ink text-sm font-semibold tabular-nums">{hours(total.worked)}</span> worked ·{' '}
                {hours(total.scheduled)} scheduled
              </p>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
