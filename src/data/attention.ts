/**
 * What's going on today, as Home shows it and the bell counts it: the day's
 * work as three cards, and anything that needs someone to act.
 */
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { startOfDayLocal, toISODate } from '@/lib/compliance'
import { formatTemp, formatTime } from '@/lib/format'
import { selectLogsForDay, selectOrdersToCheckIn, selectToday, staffName, type TodayTask } from './selectors'
import { DEFAULT_REMINDER_TITLE, wentOffToday } from './reminders'
import { isCurrentTask, taskState, taskWhen } from './tasks'
import type { AppData, ID, MonitoredItem, NotificationKind, NotificationPreferences, Reminder } from './types'

export type AttentionTone = 'fail' | 'warn' | 'pass' | 'neutral'

/** What tapping an entry does. */
export type EntryAction =
  | { kind: 'task'; id: ID }
  | { kind: 'checklist'; id: ID }
  | { kind: 'temperature'; itemId: ID }
  | { kind: 'probe' }
  | { kind: 'link'; to: string }

export interface HomeEntry {
  key: string
  title: string
  detail: string
  tone: AttentionTone
  status: string
  action: EntryAction
}

export interface HomeCard {
  key: 'tasks' | 'temperatures' | 'probe'
  title: string
  summary: string
  tone: AttentionTone
  /** The pill's words. */
  status: string | null
  /** When the last thing on it was done, once it's all done. */
  lastCheck: string | null
  entries: HomeEntry[]
}

const RANK: Record<AttentionTone, number> = { fail: 0, warn: 1, neutral: 2, pass: 3 }
const byUrgency = (a: HomeEntry, b: HomeEntry) => RANK[a.tone] - RANK[b.tone]
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const isProbe = (item: MonitoredItem) => item.category === 'cooking' || item.category === 'cooling'

function latest(times: Array<string | undefined>): string | null {
  const known = times.filter((time): time is string => Boolean(time)).sort()
  return known.length > 0 ? formatTime(known[known.length - 1]) : null
}

function tasksCard(data: AppData, now: Date, checks: TodayTask[]): HomeCard {
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  const today = data.tasks.filter(
    (task) => isCurrentTask(task, now) && (task.status === 'done' ? true : task.dueAt && parseISO(task.dueAt) <= endOfToday),
  )

  const STATE = {
    done: { tone: 'pass', status: 'Done' },
    overdue: { tone: 'fail', status: 'Overdue' },
    'due-soon': { tone: 'warn', status: 'Due soon' },
    ongoing: { tone: 'neutral', status: 'Ongoing' },
    todo: { tone: 'neutral', status: 'To do' },
  } as const

  const taskEntries = today.map((task): HomeEntry => {
    const state = taskState(task, now)
    return {
      key: task.id,
      title: task.title,
      detail: taskWhen(task),
      ...STATE[state],
      action: { kind: 'task', id: task.id },
    }
  })

  const checklistEntries = checks.flatMap((task): HomeEntry[] => {
    if (task.kind !== 'checklist') return []
    const { checklist } = task
    const finished = task.state === 'done' || task.state === 'failed'
    return [
      {
        key: task.key,
        title: checklist.template.name,
        detail: checklist.run ? `Signed off ${formatTime(checklist.run.completedAt)}` : `${checklist.template.items.length} checks`,
        ...(task.state === 'missed'
          ? STATE.overdue
          : task.state === 'due'
            ? STATE['due-soon']
            : finished
              ? STATE.done
              : STATE.todo),
        action: { kind: 'checklist', id: checklist.template.id },
      },
    ]
  })

  const entries = [...taskEntries, ...checklistEntries].sort(byUrgency)
  const remaining = entries.filter((entry) => entry.tone !== 'pass').length
  const overdue = entries.filter((entry) => entry.tone === 'fail').length
  const soon = entries.filter((entry) => entry.tone === 'warn').length

  return {
    key: 'tasks',
    title: 'Tasks',
    summary:
      entries.length === 0
        ? 'Nothing due today'
        : remaining === 0
          ? 'All completed'
          : [plural(remaining, 'task') + ' remaining', overdue > 0 ? `${overdue} overdue` : null].filter(Boolean).join(' · '),
    tone: overdue > 0 ? 'fail' : soon > 0 ? 'warn' : remaining > 0 ? 'neutral' : entries.length > 0 ? 'pass' : 'neutral',
    status: overdue > 0 ? 'Overdue' : soon > 0 ? 'Due soon' : remaining > 0 ? 'To do' : entries.length > 0 ? 'Done' : null,
    lastCheck:
      entries.length > 0 && remaining === 0
        ? latest([...today.map((task) => task.completedAt), ...checks.map((task) => (task.kind === 'checklist' ? task.checklist.run?.completedAt : undefined))])
        : null,
    entries,
  }
}

function slotEntries(checks: TodayTask[], probes: boolean): HomeEntry[] {
  return checks.flatMap((task): HomeEntry[] => {
    if (task.kind !== 'temperature' || isProbe(task.slot.item) !== probes) return []
    const { slot, state } = task
    const log = state === 'late' ? task.followUp : slot.log
    const base = { key: task.key, title: slot.item.name, action: { kind: 'temperature', itemId: slot.item.id } as const }
    if (log) {
      const detail = `${formatTemp(log.temperature)} at ${formatTime(log.recordedAt)}`
      if (state === 'failed') return [{ ...base, detail, tone: 'fail', status: 'Out of range' }]
      return [{ ...base, detail, tone: 'pass', status: state === 'late' ? 'Done late' : 'Done' }]
    }
    if (state === 'missed') return [{ ...base, detail: `Due ${slot.window.endTime}`, tone: 'fail', status: 'Overdue' }]
    if (state === 'due') return [{ ...base, detail: `Due ${slot.window.endTime}`, tone: 'warn', status: 'Due soon' }]
    return [{ ...base, detail: `From ${slot.window.startTime}`, tone: 'neutral', status: 'Later' }]
  })
}

function temperaturesCard(data: AppData, now: Date, checks: TodayTask[]): HomeCard {
  const entries = slotEntries(checks, false).sort(byUrgency)
  const outOfRange = entries.filter((entry) => entry.status === 'Out of range')
  const missed = entries.filter((entry) => entry.status === 'Overdue')
  const due = entries.filter((entry) => entry.status === 'Due soon')
  const later = entries.filter((entry) => entry.status === 'Later')
  const lastLogs = selectLogsForDay(data, now)

  let summary = 'No checks today'
  if (outOfRange.length > 0) {
    const [first] = outOfRange
    const reading = first.detail.split(' at ')[0]
    summary = outOfRange.length === 1 ? `${first.title} is ${reading}` : `${outOfRange.length} readings out of range`
  } else if (missed.length > 0) summary = `${plural(missed.length, 'check')} missed`
  else if (due.length > 0) summary = `${plural(due.length, 'check')} due`
  else if (later.length > 0) summary = `${plural(later.length, 'check')} later today`
  else if (entries.length > 0) summary = 'All completed'

  const allDone = entries.length > 0 && entries.every((entry) => entry.tone === 'pass')
  return {
    key: 'temperatures',
    title: 'Temperatures',
    summary,
    tone: outOfRange.length + missed.length > 0 ? 'fail' : due.length > 0 ? 'warn' : allDone ? 'pass' : 'neutral',
    status:
      outOfRange.length > 0
        ? 'Out of range'
        : missed.length > 0
          ? 'Overdue'
          : due.length > 0
            ? 'Due soon'
            : allDone
              ? 'Done'
              : later.length > 0
                ? 'Later'
                : null,
    lastCheck: allDone ? latest(lastLogs.map((log) => log.recordedAt)) : null,
    entries,
  }
}

function probeCard(data: AppData, now: Date, checks: TodayTask[]): HomeCard {
  const items = new Map(data.items.filter(isProbe).map((item) => [item.id, item]))
  const logs = selectLogsForDay(data, now).filter((log) => items.has(log.itemId))
  const failed = logs.filter((log) => log.outcome === 'fail')
  const slots = slotEntries(checks, true).filter((entry) => entry.tone !== 'pass')
  const missed = slots.filter((entry) => entry.tone === 'fail')
  const due = slots.filter((entry) => entry.tone === 'warn')
  const calibration = selectProbeCalibration(data, now)

  const entries: HomeEntry[] = [
    ...(calibration.needed
      ? [
          {
            key: 'calibration',
            title: 'Probe calibration',
            detail: calibration.detail,
            tone: 'warn',
            status: 'Due soon',
            action: { kind: 'link', to: '/food-probe' },
          } satisfies HomeEntry,
        ]
      : []),
    ...slots,
    ...logs.slice(0, 6).map(
      (log): HomeEntry => ({
        key: log.id,
        title: items.get(log.itemId)?.name ?? 'Reading',
        detail: `${formatTemp(log.temperature)} at ${formatTime(log.recordedAt)}`,
        tone: log.outcome === 'fail' ? 'fail' : 'pass',
        status: log.outcome === 'fail' ? 'Out of range' : 'Done',
        action: { kind: 'probe' },
      }),
    ),
  ].sort(byUrgency)

  const summary =
    failed.length > 0
      ? `${items.get(failed[0].itemId)?.name} was ${formatTemp(failed[0].temperature)}`
      : missed.length > 0
        ? `${plural(missed.length, 'check')} missed`
        : due.length > 0
          ? `${plural(due.length, 'check')} due`
          : calibration.needed
            ? 'Calibration needs check'
            : logs.length > 0
              ? `${plural(logs.length, 'reading')} logged today`
              : 'None logged yet today'
  const soon = due.length > 0 || calibration.needed

  return {
    key: 'probe',
    title: 'Food probe',
    summary,
    tone: failed.length + missed.length > 0 ? 'fail' : soon ? 'warn' : logs.length > 0 ? 'pass' : 'neutral',
    status: failed.length > 0 ? 'Out of range' : missed.length > 0 ? 'Overdue' : soon ? 'Due soon' : logs.length > 0 ? 'Done' : null,
    lastCheck: logs.length > 0 && slots.length === 0 && !calibration.needed ? latest(logs.map((log) => log.recordedAt)) : null,
    entries,
  }
}

export interface HomeOverview {
  cards: HomeCard[]
  /** The day's current check window, if one is open. */
  period: string | null
}

export function selectHome(data: AppData, now: Date): HomeOverview {
  const today = selectToday(data, now)
  const checks = today.periods.flatMap((period) => period.tasks)
  const cards = [tasksCard(data, now, checks), temperaturesCard(data, now, checks), probeCard(data, now, checks)]
  return {
    cards,
    period: today.current?.window.label ?? null,
  }
}

export type AlertGroup = 'reminder' | 'missed' | 'overdue' | 'soon' | 'attention'

export const ALERT_GROUPS: Array<{ key: AlertGroup; label: string }> = [
  { key: 'reminder', label: 'Your reminders' },
  { key: 'missed', label: 'Missed' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'soon', label: 'Coming soon' },
  { key: 'attention', label: 'Needs attention' },
]

export interface Alert {
  /** Changes with the alert's state, so something that gets worse counts as new. */
  key: string
  kind: NotificationKind | 'always' | 'reminder'
  group: AlertGroup
  tone: AttentionTone
  status: string
  title: string
  detail: string
  who?: string
  to: string
  /** Most urgent first, when sorting by priority. */
  rank: number
  /** Latest first, when sorting by recent. */
  at: string
}

const fullDate = (value: string) => format(parseISO(value), "d MMM yyyy '·' HH:mm")

/** A probe needs checking if it hasn't been, or not for a week. */
const CALIBRATION_DAYS = 7

export function selectProbeCalibration(data: AppData, now: Date): { needed: boolean; detail: string } {
  const { probeCalibratedAt: at, probeCalibratedBy: by } = data.settings
  if (!at) return { needed: true, detail: 'No calibration recorded' }
  const age = differenceInCalendarDays(now, parseISO(at))
  const who = by ? ` by ${staffName(data, by)}` : ''
  return { needed: age >= CALIBRATION_DAYS, detail: `Last recorded ${format(parseISO(at), 'd MMM yyyy')}${who}` }
}

/** `mine`: only tasks given to this person, or to nobody. */
function taskAlerts(data: AppData, now: Date, mine?: ID): Alert[] {
  const today = startOfDayLocal(now)
  return data.tasks.flatMap((task): Alert[] => {
    if (task.status === 'done' || !task.dueAt) return []
    if (mine && task.assigneeId && task.assigneeId !== mine) return []
    const due = parseISO(task.dueAt)
    const state = taskState(task, now)
    const group: AlertGroup | null = due < today ? 'missed' : state === 'overdue' ? 'overdue' : state === 'due-soon' ? 'soon' : null
    if (!group) return []
    return [
      {
        key: `${task.id}:${group}`,
        kind: 'tasks',
        group,
        tone: group === 'soon' ? 'warn' : 'fail',
        status: group === 'missed' ? 'Missed' : group === 'overdue' ? 'Overdue' : 'Due soon',
        title: task.title,
        detail: `Due ${fullDate(task.dueAt)}`,
        who: task.assigneeId ? staffName(data, task.assigneeId) : undefined,
        to: '/tasks',
        rank: { high: 0, normal: 1, low: 2 }[task.priority],
        at: task.dueAt,
      },
    ]
  })
}

function checkAlerts(data: AppData, now: Date): Alert[] {
  const stamp = now.toISOString()
  const alerts = selectToday(data, now)
    .periods.flatMap((period) => period.tasks)
    .flatMap((task): Alert[] => {
      if (task.state !== 'missed' && task.state !== 'due' && task.state !== 'failed') return []
      const late = task.state === 'missed'
      if (task.kind === 'checklist') {
        if (task.state === 'failed') return []
        return [
          {
            key: `${task.key}:${task.state}`,
            kind: 'tasks',
            group: late ? 'overdue' : 'soon',
            tone: late ? 'fail' : 'warn',
            status: late ? 'Overdue' : 'Due soon',
            title: task.checklist.template.name,
            detail: 'Sign-off checklist',
            to: '/checklists',
            rank: 1,
            at: stamp,
          },
        ]
      }
      const { slot } = task
      const probe = isProbe(slot.item)
      return [
        {
          key: `${task.key}:${task.state}`,
          kind: 'temperatures',
          group: task.state === 'due' ? 'soon' : 'overdue',
          tone: task.state === 'due' ? 'warn' : 'fail',
          status: task.state === 'failed' ? 'Out of range' : late ? 'Overdue' : 'Due soon',
          title: slot.item.name,
          detail: task.state === 'failed' && slot.log ? `${formatTemp(slot.log.temperature)} at ${formatTime(slot.log.recordedAt)}` : `Due ${slot.window.endTime}`,
          to: probe ? '/food-probe' : `/temperatures/appliance/${slot.item.id}`,
          rank: task.state === 'failed' ? 0 : 1,
          at: stamp,
        },
      ]
    })

  const calibration = selectProbeCalibration(data, now)
  if (calibration.needed) {
    alerts.push({
      key: 'calibration',
      kind: 'temperatures',
      group: 'attention',
      tone: 'warn',
      status: 'Needs check',
      title: 'Probe calibration',
      detail: calibration.detail,
      to: '/food-probe',
      rank: 1,
      at: stamp,
    })
  }
  return alerts
}

/** Who the bell is for: tasks are theirs, and sign-off requests only go to managers. */
export interface AlertViewer {
  staffId: ID
  manager: boolean
}

/**
 * Everything the bell has to say to someone, leaving out what they've turned
 * off. Someone who isn't a manager hears about their own tasks and ones nobody
 * has been given, not everyone else's; temperatures and deliveries are anyone's.
 */
export function selectAlerts(
  data: AppData,
  now: Date,
  preferences: NotificationPreferences = {},
  viewer?: AlertViewer,
): Alert[] {
  const stamp = now.toISOString()
  const orders = selectOrdersToCheckIn(data, now)
  const supplier = (id: ID) => data.suppliers.find((entry) => entry.id === id)?.name ?? 'A supplier'
  const orderAlerts = [...orders.overdue, ...orders.due].map((order): Alert => {
    const late = orders.overdue.includes(order)
    return {
      key: `${order.id}:${late ? 'late' : 'due'}`,
      kind: 'always',
      group: late ? 'overdue' : 'soon',
      tone: late ? 'fail' : 'warn',
      status: late ? 'Overdue' : 'Expected today',
      title: `${supplier(order.supplierId)} delivery`,
      detail: order.deliveryDate ? format(parseISO(order.deliveryDate), 'd MMM yyyy') : 'Order to check in',
      to: `/deliveries/order/${order.id}`,
      rank: 1,
      at: stamp,
    }
  })

  const forManagers = !viewer || viewer.manager
  const signOffs = data.issues.filter((issue) => issue.needsSignOff && forManagers).map(
    (issue): Alert => ({
      // A changed answer is a new request, even for a manager who read the last one.
      key: `${issue.id}:signoff:${issue.resolutionEdits?.length ?? 0}`,
      kind: 'signoff',
      group: 'attention',
      tone: 'warn',
      status: 'Needs sign-off',
      title: issue.title,
      detail: `Reported ${fullDate(issue.raisedAt)}`,
      to: `/food-safety/${issue.id}`,
      rank: 0,
      at: issue.resolutionEdits?.at(-1)?.at ?? issue.resolvedAt ?? issue.raisedAt,
    }),
  )

  const tasks = taskAlerts(data, now, forManagers ? undefined : viewer?.staffId)
  return [...tasks, ...checkAlerts(data, now), ...orderAlerts, ...signOffs].filter(
    (alert) => alert.kind === 'always' || alert.kind === 'reminder' || preferences[alert.kind] !== false,
  )
}

const WAITING: Array<{ group: AlertGroup; words: string }> = [
  { group: 'missed', words: 'missed' },
  { group: 'overdue', words: 'overdue' },
  { group: 'soon', words: 'coming soon' },
  { group: 'attention', words: 'to look at' },
]

/** What's on someone's list right now, in a few words. */
function waitingSummary(alerts: Alert[]): string {
  const counts = WAITING.flatMap(({ group, words }) => {
    const count = alerts.filter((alert) => alert.group === group).length
    return count > 0 ? [`${count} ${words}`] : []
  })
  return counts.length > 0 ? counts.join(' · ') : 'Nothing waiting right now'
}

/** Someone's reminders that have gone off today, each saying what's waiting among `others`. */
export function reminderAlerts(reminders: Reminder[] = [], others: Alert[], now: Date): Alert[] {
  const detail = waitingSummary(others)
  return reminders.flatMap((reminder): Alert[] => {
    const at = wentOffToday(reminder, now)
    if (!at) return []
    return [
      {
        // With the time in it, moving a reminder later today lets it go off again.
        key: `reminder:${reminder.id}:${toISODate(now)}:${reminder.time}`,
        kind: 'reminder',
        group: 'reminder',
        tone: 'neutral',
        status: `Reminder · ${reminder.time}`,
        title: reminder.note || DEFAULT_REMINDER_TITLE,
        detail,
        to: '/',
        rank: 0,
        at: at.toISOString(),
      },
    ]
  })
}
