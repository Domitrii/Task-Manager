/** Working out where shifts sit on the week's grid. No React, no pixels: minutes into a day. */
import { addDays, parseISO } from 'date-fns'
import { DAY_MINUTES, toMinutes } from '@/data/shifts'
import type { ISODate, Shift } from '@/data/types'
import { toISODate } from '@/lib/compliance'

/** Times snap to the quarter hour, like a calendar's. */
export const SNAP_MINUTES = 15

/** A shift's stretch on one day. A shift over midnight has one on each side of it. */
export interface Segment {
  shift: Shift
  date: ISODate
  start: number
  end: number
  /** The part after midnight of a shift that began the day before. */
  continued: boolean
}

export interface PlacedSegment extends Segment {
  /** Which of the side-by-side columns it takes. */
  lane: number
  /** How many side-by-side columns its overlapping group needs. */
  lanes: number
}

export const snap = (minutes: number) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Whether a shift runs past the end of its day. Ending at exactly midnight doesn't count. */
export function crossesMidnight(shift: Pick<Shift, 'startTime' | 'endTime'>): boolean {
  return toMinutes(shift.endTime) > 0 && toMinutes(shift.endTime) <= toMinutes(shift.startTime)
}

/** How long a shift is, in minutes. */
export function shiftLength(shift: Pick<Shift, 'startTime' | 'endTime'>): number {
  const length = toMinutes(shift.endTime) - toMinutes(shift.startTime)
  return length > 0 ? length : length + DAY_MINUTES
}

/** Each shift's stretches that fall on the given days, day by day. */
export function segmentsByDay(shifts: Shift[], dates: ISODate[]): Map<ISODate, Segment[]> {
  const days = new Map<ISODate, Segment[]>(dates.map((date) => [date, []]))
  for (const shift of shifts) {
    const start = toMinutes(shift.startTime)
    const overnight = crossesMidnight(shift)
    const end = overnight ? DAY_MINUTES : start + shiftLength(shift)
    days.get(shift.date)?.push({ shift, date: shift.date, start, end, continued: false })
    if (!overnight) continue
    const next = toISODate(addDays(parseISO(shift.date), 1))
    days.get(next)?.push({ shift, date: next, start: 0, end: toMinutes(shift.endTime), continued: true })
  }
  return days
}

/**
 * Sets overlapping stretches side by side. Those that overlap, directly or
 * through a third, form a group; each takes the first free lane and everyone
 * in the group shares the width evenly.
 */
export function placeInLanes(segments: Segment[]): PlacedSegment[] {
  const sorted = [...segments].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.shift.staffId.localeCompare(b.shift.staffId),
  )
  const placed: PlacedSegment[] = []
  let group: PlacedSegment[] = []
  let laneEnds: number[] = []

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length
    group = []
    laneEnds = []
  }

  for (const segment of sorted) {
    if (group.length > 0 && segment.start >= Math.max(...laneEnds)) closeGroup()
    const free = laneEnds.findIndex((end) => end <= segment.start)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = segment.end
    const item = { ...segment, lane, lanes: 1 }
    group.push(item)
    placed.push(item)
  }
  closeGroup()
  return placed
}
