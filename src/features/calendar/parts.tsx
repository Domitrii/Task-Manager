/** The pieces the Calendar and a shift's own page share. */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Check, ChevronRight, Clock, Trash2, Users } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { formatDuration, minutesBetween, shiftHours, shiftState, unavailabilityHours } from '@/data/shifts'
import { useStore } from '@/data/store'
import type { Shift, Unavailability } from '@/data/types'
import { formatTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { PinnedAction } from '@/components/shared/PinnedAction'
import { useSync } from '@/features/account/sync'

export const longDate = (date: string) => format(parseISO(date), 'EEE d MMM yyyy')

/** Whether clock actions are off, and when this device last heard from the team. */
export function useClockOffline(): { offline: boolean; lastSynced: string | null } {
  const sync = useSync()
  if (sync?.status.state !== 'offline') return { offline: false, lastSynced: null }
  return { offline: true, lastSynced: sync.status.lastSyncedAt ? formatTime(sync.status.lastSyncedAt) : null }
}

/** A clocked-in shift's running time, or a finished shift's total. */
export function ClockStatusCard({ shift, now }: { shift: Shift; now: Date }) {
  const { data } = useStore()
  const state = shiftState(shift)
  if (state === 'scheduled' || !shift.clockedInAt) return null
  const finished = state === 'complete' && shift.clockedOutAt

  return (
    <Card as="div" className="p-4">
      {finished ? (
        <Badge tone="pass" icon={<Check className="size-3" strokeWidth={3} />}>
          Shift completed
        </Badge>
      ) : (
        <Badge icon={<Clock className="size-3" />}>Clocked in</Badge>
      )}
      <p className="font-display text-ink mt-2 text-[28px] leading-tight font-bold">
        {formatDuration(minutesBetween(shift.clockedInAt, finished ? (shift.clockedOutAt as string) : now))}
      </p>
      <p className="text-ink-muted mt-0.5 text-[13px]">
        {finished
          ? `Recorded ${formatTime(shift.clockedInAt)}–${formatTime(shift.clockedOutAt as string)} · Total duration`
          : `Started ${formatTime(shift.clockedInAt)} · Elapsed at ${format(now, 'HH:mm')}`}
      </p>
      <p className="text-ink-subtle text-xs">
        {staffName(data, shift.staffId)} · {longDate(shift.date)}
      </p>
    </Card>
  )
}

/** A shift's hours and who it's for. Leads to the shift's own page. */
export function ShiftCard({ shift, plain = false }: { shift: Shift; plain?: boolean }) {
  const { data } = useStore()
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="text-ink flex items-center gap-2 text-[15px] font-semibold">
          <Users className="text-ink-muted size-4 shrink-0" />
          {shiftHours(shift)}
        </span>
        <span className="text-ink-muted mt-0.5 block text-[13px]">
          {[shift.role, staffName(data, shift.staffId)].filter(Boolean).join(' · ')}
        </span>
        <span className="text-ink-subtle block text-xs">{data.settings.venueName}</span>
      </span>
      {plain ? null : <ChevronRight className="text-ink-subtle size-4 shrink-0" />}
    </>
  )
  return plain ? (
    <Card as="div" className="flex items-center gap-3 p-4">
      {body}
    </Card>
  ) : (
    <Link
      to={`/calendar/shift/${shift.id}`}
      className="bg-surface border-line shadow-card rounded-card flex items-center gap-3 border p-4"
    >
      {body}
    </Link>
  )
}

export function UnavailabilityCard({ entry }: { entry: Unavailability }) {
  const { deleteUnavailability } = useStore()
  const toast = useToast()
  const range = entry.startDate === entry.endDate ? longDate(entry.startDate) : `${longDate(entry.startDate)} – ${longDate(entry.endDate)}`
  return (
    <Card as="div" className="flex items-start gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="text-ink block text-[15px] font-semibold">Unavailable · {unavailabilityHours(entry)}</span>
        <span className="text-ink-muted block text-[13px]">{range}</span>
        {entry.note ? <span className="text-ink-subtle block text-xs">{entry.note}</span> : null}
      </span>
      <IconButton
        label="Remove unavailability"
        size="sm"
        onClick={() => {
          deleteUnavailability(entry.id)
          toast.success('Unavailability removed')
        }}
      >
        <Trash2 className="size-4" />
      </IconButton>
    </Card>
  )
}

/** The action at the foot of the page: clocking in or out of a shift, or why you can't. */
export function ClockBar({
  shift,
  now,
  onClockedOut,
}: {
  shift: Shift | undefined
  now: Date
  onClockedOut?: () => void
}) {
  const { offline } = useClockOffline()
  const [confirming, setConfirming] = useState(false)
  const state = shift ? shiftState(shift) : null

  const bar = (children: ReactNode) => <PinnedAction>{children}</PinnedAction>

  if (state === 'complete') {
    return bar(<p className="text-ink-muted text-[13px]">Today’s shift is complete. No further shift today.</p>)
  }
  if (!shift) {
    return bar(
      <>
        <p className="text-ink-muted text-[13px]">No shift today</p>
        <Button block size="lg" disabled>
          Clock in
        </Button>
      </>,
    )
  }
  const clockingOut = state === 'clocked-in'
  if (offline) {
    return bar(
      <>
        <p className="text-ink-muted text-[13px]">Clock in and clock out are unavailable until you reconnect.</p>
        <Button block size="lg" disabled>
          {clockingOut ? 'Clock out' : 'Clock in'}
        </Button>
      </>,
    )
  }
  return (
    <>
      {bar(
        <Button block size="lg" variant="primary" onClick={() => setConfirming(true)}>
          {clockingOut ? 'Clock out' : 'Clock in'}
        </Button>,
      )}
      {confirming ? (
        <ClockSheet shift={shift} now={now} onClose={() => setConfirming(false)} onClockedOut={onClockedOut} />
      ) : null}
    </>
  )
}

function ClockSheet({
  shift,
  now,
  onClose,
  onClockedOut,
}: {
  shift: Shift
  now: Date
  onClose: () => void
  onClockedOut?: () => void
}) {
  const { data, clockIn, clockOut } = useStore()
  const out = shiftState(shift) === 'clocked-in'
  const time = format(now, 'HH:mm')

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={out ? 'Clock out?' : 'Clock in?'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (out) {
                clockOut(shift.id)
                onClockedOut?.()
              } else {
                clockIn(shift.id)
              }
              onClose()
            }}
          >
            {out ? 'Clock out' : 'Clock in'}
          </Button>
        </>
      }
    >
      <p className="text-ink text-sm font-semibold">{staffName(data, shift.staffId)}</p>
      <p className="text-ink-muted mt-2 text-[13px]">{data.settings.venueName}</p>
      <p className="text-ink-muted text-[13px]">
        {[shift.role, longDate(shift.date)].filter(Boolean).join(' · ')}
      </p>
      <div className="border-line mt-3 rounded-xl border p-3.5">
        <p className="text-ink-muted text-[13px]">Scheduled shift {shiftHours(shift)}</p>
        <p className="text-ink mt-1 text-sm font-semibold">
          {out ? 'Clock-out' : 'Clock-in'} time · {time}
        </p>
        {out && shift.clockedInAt ? (
          <p className="text-ink-muted mt-1 text-xs">
            Started {formatTime(shift.clockedInAt)} · Total duration {formatDuration(minutesBetween(shift.clockedInAt, now))}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

