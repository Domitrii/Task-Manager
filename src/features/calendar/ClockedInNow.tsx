import { useState } from 'react'
import { Link } from 'react-router-dom'
import { onBreak, selectClockedIn, shiftHours, shiftWindow, workedMs } from '@/data/shifts'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatTime } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Shift } from '@/data/types'
import { ClockOutModal } from './ClockOutModal'

/** "7h 30", or "45m". */
function worked(ms: number): string {
  const total = Math.round(ms / 60_000)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}` : `${minutes}m`
}

/**
 * Who's on the clock right now, for managers: since when, on a planned shift or
 * an extra one, on a break, or still clocked in past the end of their shift,
 * which is usually a forgotten End shift. A manager can clock anyone out from
 * here, or open the shift to correct its times.
 */
export function ClockedInNow({ now }: { now: Date }) {
  const { data } = useStore()
  const shifts = selectClockedIn(data)
  const [clockingOut, setClockingOut] = useState<Shift | null>(null)

  return (
    <section aria-labelledby="clocked-in-now" className="bg-surface shadow-card rounded-card p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="clocked-in-now" className="text-ink text-[15px] font-semibold">
          Clocked in now
        </h2>
        <span className="text-ink-muted text-[13px]">
          {shifts.length} {shifts.length === 1 ? 'person' : 'people'}
        </span>
      </div>
      {shifts.length === 0 ? (
        <p className="text-ink-muted mt-1 text-[13px]">Nobody is clocked in.</p>
      ) : (
        <ul className="divide-line mt-1 divide-y">
          {shifts.map((shift) => {
            const person = data.staff.find((member) => member.id === shift.staffId)
            const name = staffName(data, shift.staffId)
            const overdue = !shift.unscheduled && now > shiftWindow(shift).end
            return (
              <li key={shift.id} className="flex items-center gap-2 py-2.5">
                <Link to={`/calendar/shift/${shift.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar person={person ?? { id: shift.staffId, name, initials: '—' }} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-ink truncate text-sm font-medium">{name}</span>
                      {onBreak(shift) ? (
                        <Badge>On break</Badge>
                      ) : overdue ? (
                        <Badge tone="warn">Past its end</Badge>
                      ) : shift.unscheduled ? (
                        <Badge tone="info">Extra</Badge>
                      ) : null}
                    </span>
                    <span className="text-ink-muted block truncate text-xs">
                      Since {formatTime(shift.clockedInAt as string)} · {worked(workedMs(shift, now))} worked ·{' '}
                      {shift.unscheduled ? 'Extra shift' : `Shift ${shiftHours(shift)}`}
                    </span>
                  </span>
                </Link>
                <Button size="sm" onClick={() => setClockingOut(shift)} aria-label={`Clock out ${name}`}>
                  Clock out
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {clockingOut ? <ClockOutModal shift={clockingOut} onClose={() => setClockingOut(null)} /> : null}
    </section>
  )
}
