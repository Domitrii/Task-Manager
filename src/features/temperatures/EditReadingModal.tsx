import { useState } from 'react'
import { format } from 'date-fns'
import { History } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { AppData, TemperatureLog, TemperatureLogFields } from '@/data/types'
import { evaluateTemperature, formatRange } from '@/lib/compliance'
import { formatDate, formatDateTime, formatTemp, formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { canEditReading, EDIT_MINUTES, editableUntil, useReadingAccess } from './access'
import { readingDigits, readingValue, toLocalInputValue } from './reading'
import { CorrectiveActionField, ReadingInput, VerdictBanner } from './ReadingFields'
import { PhotoProofField, ReadingPhoto } from './ReadingPhoto'

/**
 * Changing a saved reading. Whoever entered it can, for a short while; a
 * manager can any time, and says why once the author's time is up. Every
 * change keeps what the reading said before.
 */
export function EditReadingModal({ log, onClose }: { log: TemperatureLog; onClose: () => void }) {
  const now = useNow()
  const { data, editTemperature } = useStore()
  const toast = useToast()
  const access = useReadingAccess()
  const item = data.items.find((entry) => entry.id === log.itemId)

  const initial = readingDigits(log.temperature)
  const savedTime = toLocalInputValue(new Date(log.recordedAt))
  const [digits, setDigits] = useState(initial.digits)
  const [negative, setNegative] = useState(initial.negative)
  const [recordedAt, setRecordedAt] = useState(savedTime)
  const [staffId, setStaffId] = useState(log.recordedBy)
  const [correctiveAction, setCorrectiveAction] = useState(log.correctiveAction ?? '')
  const [notes, setNotes] = useState(log.notes ?? '')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const parsed = readingValue(digits, negative)
  const hasValue = !Number.isNaN(parsed)
  const outcome = item && hasValue ? evaluateTemperature(item, parsed) : undefined
  const at = new Date(recordedAt)
  // `now` ticks once a minute, so a time in the current minute still counts.
  const validTime = !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime() + 60_000
  const timeChanged = recordedAt !== savedTime

  const allowed = canEditReading(log, access, now)
  // Past the author's own few minutes, it's a manager changing the record, so they say why.
  const override = !canEditReading(log, { ...access, manager: false }, now)
  const until = editableUntil(log)

  const changed =
    (hasValue && parsed !== log.temperature) ||
    timeChanged ||
    staffId !== log.recordedBy ||
    correctiveAction.trim() !== (log.correctiveAction ?? '') ||
    notes.trim() !== (log.notes ?? '') ||
    photo !== null
  const needsCorrectiveAction = outcome === 'fail' && correctiveAction.trim() === ''
  const needsReason = override && reason.trim() === ''
  const canSave = allowed && changed && hasValue && validTime && staffId !== '' && !needsCorrectiveAction && !needsReason

  function save() {
    setSubmitted(true)
    if (!canSave) return
    // The clock may have run out while the sheet was open.
    if (!canEditReading(log, access, new Date())) {
      toast.error('Too late to change this', `Readings can only be changed for ${EDIT_MINUTES} minutes. Ask a manager.`)
      onClose()
      return
    }
    editTemperature(log.id, {
      temperature: parsed,
      recordedAt: timeChanged ? at.toISOString() : log.recordedAt,
      recordedBy: staffId,
      correctiveAction: correctiveAction.trim() || undefined,
      notes: notes.trim() || undefined,
      photo: photo ?? undefined,
      reason: reason.trim() || undefined,
    })
    toast.success('Reading changed', 'What it said before is kept with it.')
    onClose()
  }

  const staffList = data.staff.filter((person) => person.active || person.id === log.recordedBy)

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change reading: ${item?.name ?? 'Reading'}`}
      description={`Recorded ${formatDateTime(log.recordedAt)} by ${staffName(data, log.recordedBy)}.${item ? ` Safe range ${formatRange(item)}.` : ''}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!allowed ? (
          <p role="alert" className="bg-fail-50 text-fail-700 dark:bg-fail-500/12 dark:text-fail-500 rounded-lg px-3 py-2 text-sm">
            Too late to change this: readings can only be changed for {EDIT_MINUTES} minutes. A manager can still change it.
          </p>
        ) : !access.manager && until ? (
          <p className="bg-surface-muted text-ink-muted rounded-lg px-3 py-2 text-sm">
            You can change this until {format(until, 'HH:mm')}. After that only a manager can.
          </p>
        ) : override ? (
          <p className="bg-surface-muted text-ink-muted rounded-lg px-3 py-2 text-sm">
            You’re changing this as a manager, so say why. What it said before stays with the reading.
          </p>
        ) : null}

        <div>
          <label htmlFor="edit-reading" className="text-ink mb-1.5 block text-sm font-semibold">
            Reading
          </label>
          <ReadingInput
            id="edit-reading"
            digits={digits}
            negative={negative}
            onDigitsChange={setDigits}
            onNegativeChange={setNegative}
            invalid={submitted && !hasValue}
          />
        </div>

        {item ? <VerdictBanner item={item} temperature={parsed} outcome={outcome} /> : null}

        {outcome === 'fail' && item ? (
          <CorrectiveActionField
            id="edit-action"
            category={item.category}
            value={correctiveAction}
            onChange={setCorrectiveAction}
            error={submitted && needsCorrectiveAction ? 'Say what was done.' : undefined}
          />
        ) : null}

        <div className="space-y-3">
          {photo ? null : (
            <div className="flex items-center gap-3">
              <ReadingPhoto log={log} size="lg" />
              <p className="text-ink-muted text-[13px]">The photo taken with the reading.</p>
            </div>
          )}
          <PhotoProofField
            id="edit-photo"
            photo={photo}
            onChange={setPhoto}
            required={false}
            label={photo ? 'New photo' : 'Photo'}
            action="Take a new photo"
            hint="Only if the first one doesn’t show the reading. That one stays in the history."
            caption={() =>
              `${item?.name ?? 'Reading'} · ${format(new Date(), 'd MMM yyyy, HH:mm')} · ${staffName(data, staffId)}`
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Checked by" required htmlFor="edit-staff">
            <Select id="edit-staff" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              {staffList.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Date and time"
            required
            htmlFor="edit-at"
            error={submitted && !validTime ? 'Choose a time that isn’t in the future.' : undefined}
          >
            <TextInput
              id="edit-at"
              type="datetime-local"
              value={recordedAt}
              max={toLocalInputValue(new Date())}
              invalid={submitted && !validTime}
              onChange={(event) => setRecordedAt(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Note" hint="Optional" htmlFor="edit-notes">
          <Textarea id="edit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <Field
          label="Why it’s changing"
          required={override}
          htmlFor="edit-reason"
          hint={override ? 'Needed once the 20 minutes are up. Kept with the reading.' : 'Optional. Kept with the reading.'}
          error={submitted && needsReason ? 'Say why you’re changing it.' : undefined}
        >
          <Textarea
            id="edit-reason"
            value={reason}
            placeholder="e.g. Typed 38 instead of 3.8"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <ReadingHistory log={log} data={data} />
      </div>
    </Modal>
  )
}

/** Each change to a reading, newest first, with what it was before. */
export function ReadingHistory({ log, data }: { log: TemperatureLog; data: AppData }) {
  const edits = log.edits ?? []
  if (edits.length === 0) return null

  // What each change led to: the next change's "before", or the reading as it is now.
  const after = (index: number): TemperatureLogFields => edits[index + 1]?.before ?? log

  return (
    <section>
      <h3 className="text-ink flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4" />
        Changes
      </h3>
      <ol className="border-line divide-line mt-2 divide-y rounded-lg border">
        {edits
          .map((edit, index) => ({ edit, index }))
          .reverse()
          .map(({ edit, index }) => (
            <li key={index} className="px-3 py-2.5">
              <p className="text-ink-muted text-xs">
                {formatDateTime(edit.at)} · {staffName(data, edit.by)}
              </p>
              <p className="text-ink mt-0.5 text-sm">{describeChange(edit.before, after(index), data)}</p>
              {edit.reason ? <p className="text-ink-muted mt-0.5 text-[13px]">“{edit.reason}”</p> : null}
            </li>
          ))}
      </ol>
    </section>
  )
}

function describeChange(before: TemperatureLogFields, after: TemperatureLogFields, data: AppData): string {
  const parts: string[] = []
  if (before.temperature !== after.temperature) {
    parts.push(`${formatTemp(before.temperature)} → ${formatTemp(after.temperature)}`)
  }
  if (before.recordedAt !== after.recordedAt) {
    const sameDay = formatDate(before.recordedAt) === formatDate(after.recordedAt)
    const show = sameDay ? formatTime : formatDateTime
    parts.push(`time ${show(before.recordedAt)} → ${show(after.recordedAt)}`)
  }
  if (before.recordedBy !== after.recordedBy) {
    parts.push(`checked by ${staffName(data, before.recordedBy)} → ${staffName(data, after.recordedBy)}`)
  }
  if ((before.correctiveAction ?? '') !== (after.correctiveAction ?? '')) parts.push('action taken changed')
  if ((before.notes ?? '') !== (after.notes ?? '')) parts.push('note changed')
  if (before.photo !== after.photo) parts.push('new photo')
  return parts.length > 0 ? parts.join(', ') : 'No visible change'
}
