import { useState } from 'react'
import { addHours, format } from 'date-fns'
import { DEFAULT_REMINDER_TITLE, EVERY_DAY, WEEK_DAYS, isFinished } from '@/data/reminders'
import type { Reminder } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { cn, createId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { chipClass } from '@/components/ui/Tabs'

type Repeat = 'daily' | 'days' | 'once'

function repeatOf(reminder: Reminder | undefined): Repeat {
  if (reminder?.date) return 'once'
  return reminder && reminder.days.length < EVERY_DAY.length ? 'days' : 'daily'
}

/** Adding a reminder, or changing one. */
export function ReminderModal({
  reminder,
  onSave,
  onDelete,
  onClose,
}: {
  reminder?: Reminder
  onSave: (reminder: Reminder) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [time, setTime] = useState(reminder?.time ?? format(addHours(new Date(), 1), 'HH:00'))
  const [repeat, setRepeat] = useState<Repeat>(repeatOf(reminder))
  const [days, setDays] = useState(reminder?.days.length ? reminder.days : EVERY_DAY)
  const [date, setDate] = useState(reminder?.date ?? toISODate(new Date()))
  const [note, setNote] = useState(reminder?.note ?? '')

  const past = repeat === 'once' && date !== '' && time !== '' && isFinished({ date, time }, new Date())
  const noDays = repeat === 'days' && days.length === 0
  const invalid = time === '' || past || noDays || (repeat === 'once' && date === '')

  function save() {
    if (invalid) return
    onSave({
      id: reminder?.id ?? createId('reminder'),
      time,
      days: repeat === 'daily' ? EVERY_DAY : days,
      date: repeat === 'once' ? date : undefined,
      note: note.trim() || undefined,
      on: true,
      setAt: new Date().toISOString(),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={reminder ? 'Change reminder' : 'New reminder'}
      footer={
        <>
          {reminder ? <Button onClick={onDelete}>Delete reminder</Button> : null}
          <Button variant={invalid ? 'secondary' : 'primary'} disabled={invalid} onClick={save}>
            Save reminder
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Time (24h)" htmlFor="reminder-time" required>
          <TextInput id="reminder-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </Field>
        <Field label="Repeat" htmlFor="reminder-repeat">
          <Select
            id="reminder-repeat"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value as Repeat)}
          >
            <option value="daily">Every day</option>
            <option value="days">On chosen days</option>
            <option value="once">Just once</option>
          </Select>
        </Field>
        {repeat === 'days' ? (
          <div role="group" aria-label="Days" className="space-y-1.5">
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map(({ day, label }) => {
                const chosen = days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => setDays(chosen ? days.filter((entry) => entry !== day) : [...days, day])}
                    className={cn(chipClass(chosen), 'border-line border px-0 text-[13px]')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {noDays ? <p className="text-fail-600 dark:text-fail-500 text-xs">Choose at least one day.</p> : null}
          </div>
        ) : null}
        {repeat === 'once' ? (
          <Field
            label="Date"
            htmlFor="reminder-date"
            required
            error={past ? 'Choose a date and time still to come.' : undefined}
          >
            <TextInput
              id="reminder-date"
              type="date"
              value={date}
              invalid={past}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        ) : null}
        <Field label="What to check (optional)" htmlFor="reminder-note">
          <TextInput
            id="reminder-note"
            value={note}
            placeholder={DEFAULT_REMINDER_TITLE}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
