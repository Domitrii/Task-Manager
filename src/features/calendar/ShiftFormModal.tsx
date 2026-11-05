import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { unavailabilityHours, unavailabilityOn } from '@/data/shifts'
import { staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import type { ClockTime, ID, ISODate, Shift } from '@/data/types'
import { createId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** The day and hours a new shift starts out with. */
export interface ShiftDraft {
  date: ISODate
  startTime: ClockTime
  endTime: ClockTime
}

/** Putting someone on the rota, or changing a shift that hasn't started. Managers only. */
export function ShiftFormModal({
  shift,
  draft,
  person: chosenPerson,
  onClose,
  onSaved,
}: {
  /** The shift to change. Without one, this adds a shift from `draft`. */
  shift?: Shift
  draft?: ShiftDraft
  /** Who a new shift is for to begin with. */
  person?: ID | null
  onClose: () => void
  onSaved?: (staffId: ID) => void
}) {
  const { data, activeStaff, saveShift, deleteShift } = useStore()
  const toast = useToast()
  const people = data.staff.filter((person) => person.active)
  const from = shift ?? draft
  const [staffId, setStaffId] = useState(shift?.staffId ?? chosenPerson ?? activeStaff.id)
  const [day, setDay] = useState(from?.date ?? '')
  const [startTime, setStartTime] = useState(from?.startTime ?? '08:00')
  const [endTime, setEndTime] = useState(from?.endTime ?? '16:00')
  const [details, setDetails] = useState(shift?.details ?? '')
  const person = people.find((entry) => entry.id === staffId)
  const clash = staffId && day ? unavailabilityOn(data, staffId, day) : undefined
  const invalid = !person || day === '' || startTime === '' || endTime === '' || startTime === endTime
  const overnight = !invalid && endTime < startTime

  function save() {
    if (invalid || !person) return
    // The latest copy, so someone clocking in while this was open isn't undone.
    const latest = shift ? data.shifts.find((entry) => entry.id === shift.id) : undefined
    saveShift({
      ...latest,
      id: shift?.id ?? createId('sh'),
      staffId,
      date: day,
      startTime,
      endTime,
      role: staffRoleLabel(person),
      details: details.trim() || undefined,
      createdBy: latest?.createdBy ?? activeStaff.id,
    })
    toast.success(shift ? 'Shift saved' : 'Shift added', `For ${person.name}.`)
    onSaved?.(staffId)
    onClose()
  }

  function remove() {
    if (!shift) return
    deleteShift(shift.id)
    toast.success('Shift removed')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={shift ? 'Edit shift' : 'Add shift'}
      size="sm"
      footer={
        <>
          {shift ? (
            <Button variant="ghost" onClick={remove} className="sm:mr-auto">
              <Trash2 className="size-4" />
              Remove shift
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={invalid} onClick={save}>
            {shift ? 'Save shift' : 'Add shift'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Person"
          htmlFor="shift-person"
          hint={clash ? `${person?.name} is unavailable that day (${unavailabilityHours(clash)}).` : undefined}
        >
          <Select id="shift-person" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            {people.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="shift-date">
          <TextInput id="shift-date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" htmlFor="shift-start">
            <TextInput id="shift-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </Field>
          <Field label="End" htmlFor="shift-end" hint={overnight ? 'Ends the next day.' : undefined}>
            <TextInput id="shift-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </Field>
        </div>
        <Field label="Shift information (optional)" htmlFor="shift-details">
          <Textarea id="shift-details" value={details} onChange={(event) => setDetails(event.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
