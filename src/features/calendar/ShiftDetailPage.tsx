import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Clock3, LogOut, Trash2 } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { currentShift, shiftState } from '@/data/shifts'
import { useStore } from '@/data/store'
import { toISODate } from '@/lib/compliance'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { useIsManager } from '@/features/temperatures/access'
import { ClockOutModal } from './ClockOutModal'
import { CorrectTimesModal } from './CorrectTimesModal'
import { ClockBar, ClockStatusCard, longDate, ShiftCard } from './parts'

export function ShiftDetailPage() {
  const { id } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const { data, activeStaffId, deleteShift } = useStore()
  const manager = useIsManager()
  const toast = useToast()
  const shift = data.shifts.find((entry) => entry.id === id)
  const [correcting, setCorrecting] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)

  if (!shift) return <Navigate to="/calendar" replace />

  const today = toISODate(now)
  // Clocking is only ever for the one shift someone's on or up next for.
  const clockable = currentShift(data, activeStaffId, now)?.id === shift.id
  const timedBelow = clockable && shiftState(shift) === 'clocked-in'

  return (
    <div className="space-y-3.5 pb-24 lg:pb-0">
      <PageHeader title="Shift detail" onBack={() => navigate('/calendar')} />

      <p className="text-ink-muted text-[13px]">
        {shift.date === today ? 'Today · ' : ''}
        {longDate(shift.date)}
      </p>

      {timedBelow ? null : <ClockStatusCard shift={shift} now={now} />}
      <ShiftCard shift={shift} plain />

      <Card as="section" className="p-4">
        <h2 className="text-ink text-sm font-semibold">Shift information</h2>
        <p className="text-ink-muted mt-1 text-[13px]">{shift.details ?? 'Nothing extra for this shift.'}</p>
      </Card>

      {shift.timeCorrections?.length ? (
        <Card as="section" className="p-4">
          <h2 className="text-ink text-sm font-semibold">Times corrected</h2>
          <ul className="mt-1 space-y-1.5">
            {shift.timeCorrections.map((entry) => (
              <li key={entry.at} className="text-ink-muted text-[13px]">
                {format(parseISO(entry.at), 'd MMM HH:mm')} by {staffName(data, entry.by)}: {entry.reason}. Before:{' '}
                {entry.before.clockedInAt ? format(parseISO(entry.before.clockedInAt), 'HH:mm') : 'not clocked in'}–
                {entry.before.clockedOutAt ? format(parseISO(entry.before.clockedOutAt), 'HH:mm') : 'not clocked out'}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {manager && shift.clockedInAt ? (
        <div className="flex flex-wrap gap-2">
          {/* Their own shift they end from the bar below, like anyone else. */}
          {shiftState(shift) === 'clocked-in' && !clockable ? (
            <Button size="sm" variant="primary" className="gap-1.5" onClick={() => setClockingOut(true)}>
              <LogOut className="size-4" />
              Clock out {staffName(data, shift.staffId)}
            </Button>
          ) : null}
          <Button size="sm" className="gap-1.5" onClick={() => setCorrecting(true)}>
            <Clock3 className="size-4" />
            Correct times
          </Button>
        </div>
      ) : null}
      {clockingOut ? <ClockOutModal shift={shift} onClose={() => setClockingOut(false)} /> : null}
      {correcting ? <CorrectTimesModal shift={shift} onClose={() => setCorrecting(false)} /> : null}

      {manager && !shift.clockedInAt ? (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            deleteShift(shift.id)
            toast.success('Shift removed')
            navigate('/calendar')
          }}
        >
          <Trash2 className="size-4" />
          Remove shift
        </Button>
      ) : null}

      {clockable ? <ClockBar shift={shift} /> : null}
    </div>
  )
}
