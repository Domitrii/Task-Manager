import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { staffName } from '@/data/selectors'
import {
  DAY_MINUTES,
  drawnShift,
  onBreak,
  shiftHours,
  shiftState,
  toClockTime,
  toMinutes,
  unavailabilityHours,
  weekDays,
  weekLabel,
} from '@/data/shifts'
import { useStore } from '@/data/store'
import type { ISODate, Shift } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { avatarFill, avatarTint, useStaffColor } from '@/components/ui/avatarColors'
import { Button, IconButton } from '@/components/ui/Button'
import {
  clamp,
  crossesMidnight,
  placeInLanes,
  segmentsByDay,
  shiftLength,
  snap,
  SNAP_MINUTES,
  type PlacedSegment,
} from './scheduleLayout'
import type { ShiftDraft } from './ShiftFormModal'

const HOUR_PX = 48
const GUTTER_PX = 48
/** The width of a day with nobody overlapping, and what each person overlapping needs to keep their name legible. */
const DAY_REM = 5.5
const LANE_REM = 1.25
/** What clicking a time puts in the form. Drag to choose something else. */
const NEW_SHIFT_MINUTES = 8 * 60
/** Dragging less than this is a shaky click, not a shift. */
const SHORTEST_DRAG = 2 * SNAP_MINUTES

const HOURS = Array.from({ length: 23 }, (_, index) => index + 1)

const toPx = (minutes: number) => (minutes / 60) * HOUR_PX

type Drag =
  | { kind: 'new'; dayIndex: number; anchor: number; start: number; end: number }
  | { kind: 'move'; shift: Shift; grab: number; dayIndex: number; start: number }
  | { kind: 'resize'; shift: Shift; end: number }

interface Point {
  dayIndex: number
  minutes: number
}

function follow(drag: Drag, point: Point): Drag {
  const at = snap(point.minutes)
  switch (drag.kind) {
    case 'new':
      return { ...drag, start: Math.min(drag.anchor, at), end: Math.max(drag.anchor, at) }
    case 'move': {
      const start = clamp(snap(point.minutes - drag.grab), 0, DAY_MINUTES - SNAP_MINUTES)
      return { ...drag, dayIndex: point.dayIndex, start }
    }
    case 'resize':
      return { ...drag, end: clamp(at, toMinutes(drag.shift.startTime) + SNAP_MINUTES, DAY_MINUTES) }
  }
}

/** The outline of what's being dragged, in place on the grid. */
function dragOutline(drag: Drag, dates: ISODate[]) {
  if (drag.kind === 'new') return { dayIndex: drag.dayIndex, start: drag.start, end: drag.end }
  if (drag.kind === 'move') {
    return { dayIndex: drag.dayIndex, start: drag.start, end: drag.start + shiftLength(drag.shift) }
  }
  return { dayIndex: dates.indexOf(drag.shift.date), start: toMinutes(drag.shift.startTime), end: drag.end }
}

/** The team's week as a time grid: everyone's shifts by the hour, for a manager to lay out. */
export function WeekSchedule({
  monday,
  now,
  onWeekChange,
  onAdd,
  onDraft,
  onOpen,
}: {
  monday: Date
  now: Date
  onWeekChange: (monday: Date) => void
  /** The Add shift button: no particular time in mind. */
  onAdd: () => void
  /** A time picked on the grid. */
  onDraft: (draft: ShiftDraft) => void
  onOpen: (shift: Shift) => void
}) {
  const { data, saveShift } = useStore()
  const scroller = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // Names stop just under the day headings as the grid scrolls, so it has to know how tall those are.
  const [headerPx, setHeaderPx] = useState(40)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragNow = useRef<Drag | null>(null)
  // A drag ends in a click on whatever's under the pointer, which mustn't count too.
  const justDragged = useRef(false)

  const days = useMemo(() => weekDays(monday), [monday])
  const dates = useMemo(() => days.map(toISODate), [days])
  const today = toISODate(now)
  const todayIndex = dates.indexOf(today)

  const placed = useMemo(() => {
    // An extra shift still going is drawn up to now.
    const segments = segmentsByDay(
      data.shifts.map((shift) => drawnShift(shift, now)),
      dates,
    )
    return dates.map((date) => placeInLanes(segments.get(date) ?? []))
  }, [data.shifts, dates, now])

  const away = useMemo(
    () =>
      dates.map((date) =>
        data.unavailability.filter((entry) => entry.startDate <= date && entry.endDate >= date),
      ),
    [data.unavailability, dates],
  )
  const anyAway = away.some((entries) => entries.length > 0)

  // A crowded day takes more room, so everyone on it keeps a readable strip.
  const columns = useMemo(() => {
    const days = placed.map((segments) => {
      const lanes = segments.reduce((most, segment) => Math.max(most, segment.lanes), 1)
      return `minmax(${Math.max(DAY_REM, lanes * LANE_REM)}rem, 1fr)`
    })
    return `${GUTTER_PX}px ${days.join(' ')}`
  }, [placed])

  useLayoutEffect(() => {
    if (header.current) setHeaderPx(header.current.offsetHeight)
  }, [away])

  // Opens on now, like a calendar: this week at the current time, any other at the first shift.
  useLayoutEffect(() => {
    const box = scroller.current
    if (!box) return
    const earliest = Math.min(...placed.flat().map((segment) => segment.start), 7 * 60)
    const from = todayIndex >= 0 ? now.getHours() * 60 - 60 : earliest
    box.scrollTop = toPx(Math.max(0, from))
    // On a screen too narrow for the whole week, today comes first after the hours.
    const column = body.current?.querySelectorAll<HTMLElement>('[data-day]')[Math.max(0, todayIndex)]
    const gutter = column ? column.getBoundingClientRect().left - box.getBoundingClientRect().left : 0
    box.scrollLeft = todayIndex > 0 ? box.scrollLeft + gutter - GUTTER_PX : 0
    // Only when the week changes: not every time someone adds a shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday])

  /** Which day and time the pointer's over, wherever it has wandered. */
  function pointAt(event: { clientX: number; clientY: number }): Point {
    const cells = body.current?.querySelectorAll<HTMLElement>('[data-day]') ?? []
    const boxes = [...cells].map((cell) => cell.getBoundingClientRect())
    const index = boxes.findIndex((box) => event.clientX < box.right)
    return {
      dayIndex: index === -1 ? dates.length - 1 : index,
      minutes: clamp(((event.clientY - (boxes[0]?.top ?? 0)) / HOUR_PX) * 60, 0, DAY_MINUTES),
    }
  }

  function begin(next: Drag) {
    dragNow.current = next
    setDrag(next)
  }

  function finish(done: Drag) {
    if (done.kind === 'new') {
      if (done.end - done.start < SHORTEST_DRAG) return
      justDragged.current = true
      onDraft({ date: dates[done.dayIndex], startTime: toClockTime(done.start), endTime: toClockTime(done.end) })
      return
    }
    const { shift } = done
    const next =
      done.kind === 'move'
        ? {
            date: dates[done.dayIndex],
            startTime: toClockTime(done.start),
            endTime: toClockTime(done.start + shiftLength(shift)),
          }
        : { date: shift.date, startTime: shift.startTime, endTime: toClockTime(done.end) }
    if (next.date === shift.date && next.startTime === shift.startTime && next.endTime === shift.endTime) return
    justDragged.current = true
    saveShift({ ...shift, ...next })
  }

  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const stop = () => {
      dragNow.current = null
      setDrag(null)
    }
    const onMove = (event: PointerEvent) => {
      if (!dragNow.current) return
      const next = follow(dragNow.current, pointAt(event))
      dragNow.current = next
      setDrag(next)
    }
    const onUp = () => {
      if (dragNow.current) finish(dragNow.current)
      stop()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('keydown', onKey)
    }
    // Everything it needs is fixed for the length of a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  /** Dragging is for mice: on a touch screen the same movement scrolls the week. */
  const isMouse = (event: ReactPointerEvent) => event.pointerType === 'mouse' && event.button === 0

  function pressDay(event: ReactPointerEvent, dayIndex: number) {
    justDragged.current = false
    if (!isMouse(event)) return
    const anchor = snap(pointAt(event).minutes)
    begin({ kind: 'new', dayIndex, anchor, start: anchor, end: anchor })
  }

  function pressShift(event: ReactPointerEvent, segment: PlacedSegment, dayIndex: number) {
    event.stopPropagation()
    justDragged.current = false
    if (!isMouse(event) || !canReschedule(segment)) return
    const grab = pointAt(event).minutes - segment.start
    begin({ kind: 'move', shift: segment.shift, grab, dayIndex, start: segment.start })
  }

  function pressEdge(event: ReactPointerEvent, segment: PlacedSegment) {
    event.stopPropagation()
    justDragged.current = false
    if (isMouse(event)) begin({ kind: 'resize', shift: segment.shift, end: segment.end })
  }

  function clickDay(event: ReactMouseEvent, dayIndex: number) {
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    const start = clamp(snap(pointAt(event).minutes), 0, DAY_MINUTES - SNAP_MINUTES)
    onDraft({
      date: dates[dayIndex],
      startTime: toClockTime(start),
      endTime: toClockTime(start + NEW_SHIFT_MINUTES),
    })
  }

  function clickShift(event: ReactMouseEvent, shift: Shift) {
    event.stopPropagation()
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    onOpen(shift)
  }

  const outline = drag ? dragOutline(drag, dates) : null
  const showOutline = outline !== null && (drag?.kind !== 'new' || outline.end - outline.start >= SHORTEST_DRAG)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <section aria-label="Team schedule" className="space-y-2.5">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex items-center justify-between gap-2 lg:shrink-0">
          <h2 className="font-display text-ink min-w-0 text-lg font-bold">{weekLabel(monday)}</h2>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" onClick={() => onWeekChange(startOfWeek(now, { weekStartsOn: 1 }))}>
              Today
            </Button>
            <IconButton label="Previous week" size="sm" onClick={() => onWeekChange(addWeeks(monday, -1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton label="Next week" size="sm" onClick={() => onWeekChange(addWeeks(monday, 1))}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <p className="text-ink-muted min-w-0 text-[13px]">
            <span className="pointer-coarse:hidden">Click a time to add a shift, or drag to choose its hours.</span>
            <span className="hidden pointer-coarse:inline">Tap a time to add a shift.</span>
          </p>
          <Button variant="primary" size="sm" onClick={onAdd} className="shrink-0">
            <Plus className="size-4" />
            Add shift
          </Button>
        </div>
      </div>

      <div
        ref={scroller}
        role="region"
        aria-label="Week grid"
        tabIndex={0}
        className="scrollbar-none bg-surface border-line rounded-card isolate h-[clamp(20rem,calc(100dvh-26rem),48rem)] overflow-auto border lg:h-[clamp(24rem,calc(100dvh-21.5rem),52rem)]"
      >
        <div className="w-max min-w-full">
          <div ref={header} className="bg-surface border-line sticky top-0 z-30 border-b">
            <div className="grid" style={{ gridTemplateColumns: columns }}>
              <div className="bg-surface sticky left-0 z-10" />
              {days.map((day, index) => (
                <div
                  key={dates[index]}
                  className={cn(
                    'flex h-10 items-center justify-center gap-1.5 text-[13px]',
                    index === todayIndex ? 'text-ink font-semibold' : 'text-ink-muted',
                  )}
                >
                  {format(day, 'EEE')}
                  <span
                    className={cn(
                      'tabular-nums',
                      index === todayIndex && 'bg-brand-600 rounded-md px-1.5 py-0.5 leading-none text-white',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
              ))}
            </div>

            {anyAway ? (
              <div className="border-line grid border-t" style={{ gridTemplateColumns: columns }}>
                <div className="bg-surface text-ink-subtle sticky left-0 z-10 flex items-center justify-end pr-1.5 text-[11px]">
                  Away
                </div>
                {away.map((entries, index) => (
                  <div key={dates[index]} className="border-line min-w-0 space-y-0.5 border-l p-1">
                    {entries.map((entry) => (
                      <span key={entry.id} className="text-ink-muted flex min-w-0 items-center gap-1 text-[10px]">
                        <Avatar person={data.staff.find((person) => person.id === entry.staffId)} size="xs" />
                        <span className="truncate">{unavailabilityHours(entry)}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div ref={body} className="grid" style={{ gridTemplateColumns: columns }}>
            <div className="bg-surface sticky left-0 z-20" style={{ height: toPx(DAY_MINUTES) }}>
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className={cn(
                    'text-ink-subtle absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums',
                    // Out of the way of the time now, which sits in the same gutter.
                    todayIndex >= 0 && Math.abs(hour * 60 - nowMinutes) < 15 && 'invisible',
                  )}
                  style={{ top: hour * HOUR_PX }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
              {todayIndex >= 0 ? (
                <span
                  className="bg-brand-600 absolute right-0.5 z-10 -translate-y-1/2 rounded px-1 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums"
                  style={{ top: toPx(nowMinutes) }}
                >
                  {format(now, 'HH:mm')}
                </span>
              ) : null}
            </div>

            {placed.map((segments, dayIndex) => (
              <div
                key={dates[dayIndex]}
                data-day
                role="group"
                aria-label={format(parseISO(dates[dayIndex]), 'EEEE d MMMM')}
                className="border-line relative border-l select-none"
                style={{
                  gridRow: 1,
                  gridColumn: dayIndex + 2,
                  backgroundImage: 'linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)',
                  backgroundSize: `100% ${HOUR_PX}px`,
                }}
                onPointerDown={(event) => pressDay(event, dayIndex)}
                onClick={(event) => clickDay(event, dayIndex)}
              >
                {segments.map((segment) => (
                  <ShiftBlock
                    key={`${segment.shift.id}-${segment.date}`}
                    segment={segment}
                    stickTo={headerPx}
                    faded={drag !== null && drag.kind !== 'new' && drag.shift.id === segment.shift.id}
                    onPress={(event) => pressShift(event, segment, dayIndex)}
                    onPressEdge={(event) => pressEdge(event, segment)}
                    onClick={(event) => clickShift(event, segment.shift)}
                  />
                ))}
                {showOutline && outline?.dayIndex === dayIndex ? (
                  <div
                    className="bg-brand-100 border-brand-500 text-brand-800 dark:bg-brand-500/25 dark:text-brand-100 pointer-events-none absolute inset-x-0.5 z-20 overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{
                      top: toPx(outline.start),
                      height: toPx(Math.min(outline.end, DAY_MINUTES) - outline.start),
                    }}
                  >
                    {toClockTime(outline.start)}–{toClockTime(outline.end)}
                  </div>
                ) : null}
                {dayIndex === todayIndex ? (
                  <div
                    className="bg-brand-600 pointer-events-none absolute inset-x-0 z-10 h-0.5 -translate-y-1/2 rounded-full"
                    style={{ top: toPx(nowMinutes) }}
                  />
                ) : null}
              </div>
            ))}

            {todayIndex >= 0 ? (
              <div className="pointer-events-none relative" style={{ gridRow: 1, gridColumn: '2 / -1' }}>
                <div className="bg-brand-600/40 absolute inset-x-0 h-px" style={{ top: toPx(nowMinutes) }} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Once someone has clocked in, their shift's times are a record, not a plan. */
const canReschedule = (segment: PlacedSegment) => !segment.shift.clockedInAt && !segment.continued

function ShiftBlock({
  segment,
  stickTo,
  faded,
  onPress,
  onPressEdge,
  onClick,
}: {
  segment: PlacedSegment
  /** How far down the grid its name stops as it scrolls. */
  stickTo: number
  faded: boolean
  onPress: (event: ReactPointerEvent) => void
  onPressEdge: (event: ReactPointerEvent) => void
  onClick: (event: ReactMouseEvent) => void
}) {
  const { data } = useStore()
  const { shift } = segment
  const color = useStaffColor(shift.staffId)
  const name = staffName(data, shift.staffId)
  const state = shiftState(shift)
  const status =
    state === 'complete' ? 'Shift completed' : state === 'clocked-in' ? (onBreak(shift) ? 'On break' : 'Clocked in') : null
  const description = [name, shiftHours(shift), status].filter(Boolean).join(', ')
  const width = 100 / segment.lanes
  const height = Math.max(toPx(segment.end - segment.start) - 2, 18)
  const movable = canReschedule(segment)

  const mark =
    state === 'complete' ? (
      <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden />
    ) : state === 'clocked-in' ? (
      <span
        className={cn('size-2 shrink-0 rounded-full', onBreak(shift) ? 'bg-warn-500' : 'bg-pass-500')}
        aria-hidden
      />
    ) : null

  return (
    <div
      className={cn(
        '@container absolute z-0 overflow-clip rounded-md transition-opacity hover:z-10',
        avatarTint(color ?? 0),
        state === 'complete' && 'opacity-60',
        faded && 'opacity-40',
      )}
      style={{
        top: toPx(segment.start) + 1,
        height,
        left: `calc(${segment.lane * width}% + 1px)`,
        width: `calc(${width}% - 2px)`,
      }}
    >
      <button
        type="button"
        title={description}
        aria-label={description}
        onPointerDown={onPress}
        onClick={onClick}
        className={cn('absolute inset-0 focus-visible:-outline-offset-2', movable && 'cursor-grab')}
      />
      <span className={cn('absolute inset-y-0 left-0 w-0.5', avatarFill(color))} aria-hidden />

      <span className="pointer-events-none sticky block" style={{ top: stickTo }} aria-hidden>
        {/* Too narrow to read across, so the name runs down the strip. */}
        <span className="flex flex-col items-center gap-1 py-1 pl-0.5 @[3.5rem]:hidden">
          {mark}
          <span
            className="truncate text-[11px] leading-none font-semibold [writing-mode:vertical-rl]"
            style={{ maxHeight: height - (mark ? 24 : 8) }}
          >
            {name}
          </span>
        </span>
        <span className="hidden py-1 pr-1 pl-1.5 leading-tight @[3.5rem]:block">
          <span className="flex items-center gap-1 text-[11px] font-semibold">
            <span className="min-w-0 truncate">{name}</span>
            {mark}
          </span>
          <span className="block truncate text-[10px] tabular-nums">{shiftHours(shift)}</span>
        </span>
      </span>

      {movable && !crossesMidnight(shift) ? (
        <span
          aria-hidden
          onPointerDown={onPressEdge}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        />
      ) : null}
    </div>
  )
}
