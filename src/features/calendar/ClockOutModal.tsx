import { useState } from 'react'
import { breakMs, shiftHours, shiftWindow, workedMs } from '@/data/shifts'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { Shift } from '@/data/types'
import { formatTime } from '@/lib/format'
import { toLocalInputValue } from '@/features/temperatures/reading'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** "7h 30", or "45m". */
function duration(ms: number): string {
  const total = Math.round(ms / 60_000)
  const hours = Math.floor(total / 60)
  return hours > 0 ? `${hours}h ${String(total % 60).padStart(2, '0')}` : `${total}m`
}

/**
 * A manager clocking someone out: now, or when they actually left, so a
 * forgotten End shift doesn't pay the hours after it. The shift says who
 * clocked them out.
 */
export function ClockOutModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { data, clockOut } = useStore()
  const toast = useToast()
  const [opened] = useState(() => new Date())
  const [at, setAt] = useState(() => toLocalInputValue(opened))
  const name = staffName(data, shift.staffId)

  // No earlier than they clocked in, or than a break they started; no later than now.
  const starts = [shift.clockedInAt, ...(shift.breaks ?? []).map((entry) => entry.startedAt)].filter((value): value is string => Boolean(value))
  const earliest = toLocalInputValue(new Date(Math.max(...starts.map((value) => Date.parse(value)))))
  const latest = toLocalInputValue(new Date())
  const problem =
    at === '' ? 'When did they leave?' : at > latest ? 'That’s still to come.' : at < earliest ? `They were working until at least ${formatTime(new Date(earliest).toISOString())}.` : null

  const planned = shift.unscheduled ? null : shiftWindow(shift)
  const pastEnd = planned && opened > planned.end ? toLocalInputValue(planned.end) : null
  const when = new Date(at)
  const preview = problem ? null : { ...shift, clockedOutAt: when.toISOString() }

  function save() {
    if (problem) return
    clockOut(shift.id, when)
    toast.success(`${name} clocked out`, `At ${formatTime(when.toISOString())}.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Clock out ${name}?`}
      description={`${data.settings.venueName} · ${shift.unscheduled ? 'Extra shift' : `Shift ${shiftHours(shift)}`}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={problem !== null} onClick={save}>
            Clock out
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted text-[13px]">
          Clocked in at {formatTime(shift.clockedInAt as string)}
          {preview ? ` · ${duration(workedMs(preview, when))} worked` : ''}
          {preview && breakMs(preview, when) > 0 ? ` · ${duration(breakMs(preview, when))} on break` : ''}
        </p>
        <Field
          label="Clocked out at"
          htmlFor="clock-out-at"
          hint="Now, or when they actually left. It shows on the shift that you clocked them out."
          error={problem ?? undefined}
        >
          <TextInput
            id="clock-out-at"
            type="datetime-local"
            min={earliest}
            max={latest}
            value={at}
            invalid={problem !== null}
            onChange={(event) => setAt(event.target.value)}
          />
        </Field>
        {pastEnd && planned ? (
          <Button size="sm" onClick={() => setAt(pastEnd)}>
            At the end of their shift, {formatTime(planned.end.toISOString())}
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
