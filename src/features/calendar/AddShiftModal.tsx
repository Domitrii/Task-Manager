import { useState } from 'react'
import { unavailabilityHours, unavailabilityOn } from '@/data/shifts'
import { staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import type { ISODate } from '@/data/types'
import { createId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** Putting someone on the rota. Managers only. */
export function AddShiftModal({ date, onClose }: { date: ISODate; onClose: () => void }) {
  const { data, activeStaff, saveShift } = useStore()
  const toast = useToast()
  const people = data.staff.filter((person) => person.active)
  const [staffId, setStaffId] = useState(activeStaff.id)
  const [day, setDay] = useState(date)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('16:00')
  const [details, setDetails] = useState('')
  const person = people.find((entry) => entry.id === staffId)
  const clash = staffId && day ? unavailabilityOn(data, staffId, day) : undefined
  const invalid = !person || day === '' || startTime === '' || endTime === '' || startTime === endTime

  function save() {
    if (invalid || !person) return
    saveShift({
      id: createId('sh'),
      staffId,
      date: day,
      startTime,
      endTime,
      role: staffRoleLabel(person),
      details: details.trim() || undefined,
      createdBy: activeStaff.id,
    })
    toast.success('Shift added', `For ${person.name}.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add shift"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={invalid} onClick={save}>
            Add shift
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
          <Field label="End" htmlFor="shift-end">
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
