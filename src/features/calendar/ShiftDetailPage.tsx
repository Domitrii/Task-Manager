import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { shiftState } from '@/data/shifts'
import { useStore } from '@/data/store'
import { toISODate } from '@/lib/compliance'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { useIsManager } from '@/features/temperatures/access'
import { ClockBar, ClockStatusCard, longDate, ShiftCard } from './parts'

export function ShiftDetailPage() {
  const { id } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const { data, activeStaffId, deleteShift } = useStore()
  const manager = useIsManager()
  const toast = useToast()
  const shift = data.shifts.find((entry) => entry.id === id)

  if (!shift) return <Navigate to="/calendar" replace />

  const today = toISODate(now)
  const mine = shift.staffId === activeStaffId
  // Clocking is for someone's own shift, today, or one they're still on.
  const clockable = mine && (shift.date === today || shiftState(shift) === 'clocked-in')

  return (
    <div className="space-y-3.5 pb-16 lg:pb-0">
      <PageHeader title="Shift detail" onBack={() => navigate('/calendar')} />

      <p className="text-ink-muted text-[13px]">
        {shift.date === today ? 'Today · ' : ''}
        {longDate(shift.date)}
      </p>

      <ClockStatusCard shift={shift} now={now} />
      <ShiftCard shift={shift} plain />

      <Card as="section" className="p-4">
        <h2 className="text-ink text-sm font-semibold">Shift information</h2>
        <p className="text-ink-muted mt-1 text-[13px]">{shift.details ?? 'Nothing extra for this shift.'}</p>
      </Card>

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

      {clockable ? <ClockBar shift={shift} now={now} /> : null}
    </div>
  )
}
