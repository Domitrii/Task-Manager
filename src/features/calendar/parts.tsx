/** The pieces the Calendar and a shift's own page share. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { Check, ChevronRight, Clock, Coffee, Trash2, Users } from 'lucide-react'
import { staffName } from '@/data/selectors'
import {
  breakMs,
  canClockIn,
  currentBreak,
  formatDuration,
  formatTimer,
  onBreak,
  shiftHours,
  shiftState,
  shiftWindow,
  unavailabilityHours,
  workedMs,
} from '@/data/shifts'
import { useStore } from '@/data/store'
import type { Shift, Unavailability } from '@/data/types'
import { formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
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

const msToMinutes = (ms: number) => ms / 60_000

/** A shift's time worked so far, or its total once finished. Breaks don't count. */
export function ClockStatusCard({ shift, now }: { shift: Shift; now: Date }) {
  const { data } = useStore()
  const state = shiftState(shift)
  if (state === 'scheduled' || !shift.clockedInAt) return null
  const finished = state === 'complete' && shift.clockedOutAt
  const breaks = breakMs(shift, now)

  return (
    <Card as="div" className="p-4">
      {finished ? (
        <Badge tone="pass" icon={<Check className="size-3" strokeWidth={3} />}>
          Shift completed
        </Badge>
      ) : (
        <Badge icon={<Clock className="size-3" />}>{onBreak(shift) ? 'On break' : 'Clocked in'}</Badge>
      )}
      <p className="font-display text-ink mt-2 text-[28px] leading-tight font-bold">
        {formatDuration(msToMinutes(workedMs(shift, now)))}
      </p>
      <p className="text-ink-muted mt-0.5 text-[13px]">
        {finished
          ? `Recorded ${formatTime(shift.clockedInAt)}–${formatTime(shift.clockedOutAt as string)} · Total worked`
          : `Started ${formatTime(shift.clockedInAt)} · Worked by ${format(now, 'HH:mm')}`}
        {finished && shift.clockedOutBy ? ` · Clocked out by ${staffName(data, shift.clockedOutBy)}` : ''}
        {breaks > 0 ? ` · Break ${formatDuration(msToMinutes(breaks))}` : ''}
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

/**
 * The foot of the page: Clock in, or once clocked in, the running timer with
 * Break and End shift. Ticks every second on its own, so the page doesn't have to.
 */
export function ClockBar({ shift, onClockedOut }: { shift: Shift | undefined; onClockedOut?: () => void }) {
  const now = useNow(1_000)
  const { offline } = useClockOffline()
  const [confirming, setConfirming] = useState(false)
  const state = shift ? shiftState(shift) : null

  // Clocking in without a shift on the schedule starts an extra one.
  const extra = !shift || state === 'complete'
  const sheet = confirming ? (
    <ClockSheet
      shift={extra ? undefined : shift}
      now={now}
      onClose={() => setConfirming(false)}
      onClockedOut={onClockedOut}
    />
  ) : null

  if (extra) {
    return (
      <>
        <PinnedAction>
          <p className="text-ink-muted text-[13px]">
            {offline
              ? 'Clock in and clock out are unavailable until you reconnect.'
              : shift
                ? `Shift complete, ${formatDuration(msToMinutes(workedMs(shift, now)))} worked. Back in? Clocking in again starts an extra shift.`
                : 'No shift on the schedule today. You can still clock in: it’s recorded as an extra shift.'}
          </p>
          <Button
            block
            size="lg"
            variant={shift || offline ? 'secondary' : 'primary'}
            disabled={offline}
            onClick={() => setConfirming(true)}
          >
            {shift ? 'Clock in again' : 'Clock in'}
          </Button>
        </PinnedAction>
        {sheet}
      </>
    )
  }

  if (state === 'clocked-in') {
    return (
      <>
        <ShiftTimer shift={shift} now={now} offline={offline} onEnd={() => setConfirming(true)} />
        {sheet}
      </>
    )
  }

  const allowed = canClockIn(shift, now)
  return (
    <>
      <PinnedAction>
        {offline ? (
          <p className="text-ink-muted text-[13px]">Clock in and clock out are unavailable until you reconnect.</p>
        ) : !allowed ? (
          <p className="text-ink-muted text-[13px]">You can clock in from {shift.startTime}, when your shift starts.</p>
        ) : null}
        <Button
          block
          size="lg"
          variant={allowed && !offline ? 'primary' : 'secondary'}
          disabled={!allowed || offline}
          onClick={() => setConfirming(true)}
        >
          Clock in
        </Button>
      </PinnedAction>
      {sheet}
    </>
  )
}

/** Where Clock in was: how long they've been working, or how long they've been on break. */
function ShiftTimer({
  shift,
  now,
  offline,
  onEnd,
}: {
  shift: Shift
  now: Date
  offline: boolean
  onEnd: () => void
}) {
  const { startBreak, endBreak } = useStore()
  const running = currentBreak(shift)
  const worked = formatTimer(workedMs(shift, now))

  return (
    <PinnedAction>
      <div className="sm:flex sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:justify-start sm:gap-5">
          <p className="min-w-0">
            <span className="text-ink flex items-center gap-1.5 text-sm font-semibold">
              {running ? <Coffee className="size-4 shrink-0" /> : <Clock className="size-4 shrink-0" />}
              {running ? 'On break' : 'Clocked in'}
            </span>
            <span className="text-ink-muted block truncate text-xs">
              {running
                ? `Worked ${worked}`
                : shift.unscheduled
                  ? `Since ${formatTime(shift.clockedInAt as string)} · Extra shift`
                  : `Since ${formatTime(shift.clockedInAt as string)}, ends ${shift.endTime}`}
            </span>
          </p>
          <p role="timer" className="text-ink shrink-0 text-[30px] leading-none font-bold tabular-nums">
            {running ? formatTimer(now.getTime() - Date.parse(running.startedAt)) : worked}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-0 sm:w-80 sm:shrink-0">
          <Button
            size="lg"
            disabled={offline}
            onClick={() => (running ? endBreak(shift.id) : startBreak(shift.id))}
          >
            {running ? 'End break' : 'Break'}
          </Button>
          <Button size="lg" variant="primary" disabled={offline} onClick={onEnd}>
            End shift
          </Button>
        </div>
      </div>
      {offline ? <p className="text-ink-muted text-[13px]">Break and End shift are unavailable until you reconnect.</p> : null}
    </PinnedAction>
  )
}

/** How far from the plan: "0h 40 before the scheduled end". Nothing when spot on. */
function offSchedule(minutes: number, what: string): string | null {
  if (minutes === 0) return null
  return `${formatDuration(Math.abs(minutes))} ${minutes < 0 ? 'before' : 'after'} the scheduled ${what}`
}

/** Confirming a clock-in or End shift. Without a `shift`, clocking in starts an extra one. */
function ClockSheet({
  shift,
  now,
  onClose,
  onClockedOut,
}: {
  shift: Shift | undefined
  now: Date
  onClose: () => void
  onClockedOut?: () => void
}) {
  const { data, activeStaff, clockIn, clockInWithoutShift, clockOut } = useStore()
  const out = shift !== undefined && shiftState(shift) === 'clocked-in'
  const time = format(now, 'HH:mm')
  // To the nearest minute: the seconds on the clock shouldn't turn 6h 00 into 5h 59.
  const minutesFrom = (time: Date) => differenceInMinutes(now, time, { roundingMethod: 'round' })
  const planned = shift && !shift.unscheduled ? shiftWindow(shift) : null
  const drift = planned ? (out ? offSchedule(minutesFrom(planned.end), 'end') : offSchedule(minutesFrom(planned.start), 'start')) : null
  const breaks = shift ? breakMs(shift, now) : 0

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={out ? 'End shift?' : 'Clock in?'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (out) {
                clockOut(shift.id)
                onClockedOut?.()
              } else if (shift) {
                clockIn(shift.id)
              } else {
                clockInWithoutShift()
              }
              onClose()
            }}
          >
            {out ? 'End shift' : 'Clock in'}
          </Button>
        </>
      }
    >
      <p className="text-ink text-sm font-semibold">{shift ? staffName(data, shift.staffId) : activeStaff.name}</p>
      <p className="text-ink-muted mt-2 text-[13px]">{data.settings.venueName}</p>
      <p className="text-ink-muted text-[13px]">
        {[shift?.role, longDate(shift?.date ?? format(now, 'yyyy-MM-dd'))].filter(Boolean).join(' · ')}
      </p>
      <div className="border-line mt-3 rounded-xl border p-3.5">
        <p className="text-ink-muted text-[13px]">
          {planned && shift ? `Scheduled shift ${shiftHours(shift)}` : 'Extra shift, not on the schedule. A manager can see it.'}
        </p>
        <p className="text-ink mt-1 text-sm font-semibold">
          {out ? 'End' : 'Clock-in'} time · {time}
        </p>
        {drift ? <p className="text-ink-muted mt-1 text-xs">{drift}</p> : null}
        {out && shift?.clockedInAt ? (
          <p className="text-ink-muted mt-1 text-xs">
            Started {formatTime(shift.clockedInAt)} · Worked {formatDuration(msToMinutes(workedMs(shift, now)))}
            {breaks > 0 ? ` · Break ${formatDuration(msToMinutes(breaks))}` : ''}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
