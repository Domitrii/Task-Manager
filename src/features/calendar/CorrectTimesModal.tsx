import { useState } from 'react'
import { closeBreaks } from '@/data/shifts'
import { useStore } from '@/data/store'
import type { Shift } from '@/data/types'
import { toLocalInputValue } from '@/features/temperatures/reading'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/**
 * A manager putting right the times someone clocked: a forgotten End shift, or
 * a clock-in made late because the tablet was out of reach. What it said before
 * stays on the shift, with who changed it and why.
 */
export function CorrectTimesModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { activeStaff, saveShift } = useStore()
  const toast = useToast()
  const [clockedIn, setClockedIn] = useState(shift.clockedInAt ? toLocalInputValue(new Date(shift.clockedInAt)) : '')
  const [clockedOut, setClockedOut] = useState(shift.clockedOutAt ? toLocalInputValue(new Date(shift.clockedOutAt)) : '')
  const [reason, setReason] = useState('')

  const latest = toLocalInputValue(new Date())
  const inFuture = (value: string) => value !== '' && value > latest
  const outBeforeIn = clockedOut !== '' && clockedIn !== '' && clockedOut <= clockedIn
  const unchanged =
    clockedIn === (shift.clockedInAt ? toLocalInputValue(new Date(shift.clockedInAt)) : '') &&
    clockedOut === (shift.clockedOutAt ? toLocalInputValue(new Date(shift.clockedOutAt)) : '')
  const problem =
    clockedIn === ''
      ? 'When did they clock in?'
      : inFuture(clockedIn) || inFuture(clockedOut)
        ? 'Times can’t be in the future.'
        : outBeforeIn
          ? 'They can’t clock out before they clock in.'
          : null
  const ready = problem === null && !unchanged && reason.trim() !== ''

  function save() {
    if (!ready) return
    const out = clockedOut ? new Date(clockedOut) : undefined
    saveShift({
      ...shift,
      clockedInAt: new Date(clockedIn).toISOString(),
      clockedOutAt: out?.toISOString(),
      // A break still running when they're clocked out ends there.
      breaks: out ? closeBreaks(shift, out) : shift.breaks,
      timeCorrections: [
        ...(shift.timeCorrections ?? []),
        {
          at: new Date().toISOString(),
          by: activeStaff.id,
          reason: reason.trim(),
          before: { clockedInAt: shift.clockedInAt, clockedOutAt: shift.clockedOutAt },
        },
      ],
    })
    toast.success('Times corrected', 'What they said before is kept on the shift.')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Correct clocked times"
      description="For a forgotten End shift, or a clock that was wrong. Everyone can see what it said before."
      footer={
        <Button variant={ready ? 'primary' : 'secondary'} disabled={!ready} onClick={save}>
          Save times
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Clocked in" htmlFor="correct-in" required>
          <TextInput
            id="correct-in"
            type="datetime-local"
            max={latest}
            value={clockedIn}
            onChange={(event) => setClockedIn(event.target.value)}
          />
        </Field>
        <Field label="Clocked out" htmlFor="correct-out" hint="Leave empty if they’re still working." error={problem && clockedIn !== '' ? problem : undefined}>
          <TextInput
            id="correct-out"
            type="datetime-local"
            max={latest}
            value={clockedOut}
            invalid={outBeforeIn}
            onChange={(event) => setClockedOut(event.target.value)}
          />
        </Field>
        <Field label="Why" htmlFor="correct-reason" required>
          <TextInput
            id="correct-reason"
            value={reason}
            placeholder="e.g. Forgot to end the shift"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
