import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useStore } from '@/data/store'
import type { ISODate } from '@/data/types'
import { Button } from '@/components/ui/Button'
import { Field, TextInput, ToggleRow } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'

/** Saying when you can't work. */
export function AddUnavailabilityModal({
  date,
  onClose,
  onSaved,
}: {
  date: ISODate
  onClose: () => void
  onSaved: () => void
}) {
  const { data, activeStaffId, saveUnavailability } = useStore()
  const [startDate, setStartDate] = useState(date)
  const [endDate, setEndDate] = useState(date)
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('12:00')
  const [endTime, setEndTime] = useState('16:00')
  const [note, setNote] = useState('')

  const badDates = endDate !== '' && startDate !== '' && endDate < startDate
  const badTimes = !allDay && startDate === endDate && endTime <= startTime
  const incomplete = startDate === '' || endDate === '' || (!allDay && (startTime === '' || endTime === ''))
  const invalid = badDates || badTimes || incomplete

  function save() {
    if (invalid) return
    saveUnavailability({
      staffId: activeStaffId,
      startDate,
      endDate,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      note: note.trim() || undefined,
    })
    onSaved()
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="page"
      title="Add unavailability"
      footer={
        <Button variant={invalid ? 'secondary' : 'primary'} size="lg" disabled={invalid} onClick={save}>
          Save unavailability
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted text-[13px]">
          Record when you’re unavailable at {data.settings.venueName}.
        </p>
        <Field label="Start date" htmlFor="unavailable-start">
          <TextInput
            id="unavailable-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field
          label="End date"
          htmlFor="unavailable-end"
          error={badDates ? `End date must be on or after ${format(parseISO(startDate), 'd MMM yyyy')}.` : undefined}
        >
          <TextInput
            id="unavailable-end"
            type="date"
            value={endDate}
            invalid={badDates}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        <ToggleRow
          title="All day"
          description={allDay ? 'Unavailable for the whole day.' : 'Choose a start and end time.'}
          checked={allDay}
          onChange={setAllDay}
        />
        {allDay ? null : (
          <>
            <Field label="Start time (24h)" htmlFor="unavailable-from">
              <TextInput
                id="unavailable-from"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </Field>
            <Field
              label="End time (24h)"
              htmlFor="unavailable-to"
              error={badTimes ? 'End time must be after the start time.' : undefined}
            >
              <TextInput
                id="unavailable-to"
                type="time"
                value={endTime}
                invalid={badTimes}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Note (optional)" htmlFor="unavailable-note">
          <TextInput
            id="unavailable-note"
            value={note}
            placeholder="Add a note"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        {badDates ? (
          <p className="text-ink-muted text-[13px]">Check the end date before saving. Your other entries are retained.</p>
        ) : null}
      </div>
    </Modal>
  )
}
