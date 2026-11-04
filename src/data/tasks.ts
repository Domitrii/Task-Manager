/**
 * The Checklist's rules: how sections order their tasks, what state a task is
 * in, and what comes after a repeating one.
 */
import { addDays, addMonths, addWeeks, format, isToday, parseISO } from 'date-fns'
import { startOfDayLocal } from '@/lib/compliance'
import type { Task, TaskRepeat, TaskSection } from './types'

/** Stands in for a section id, for tasks that aren't in a section. */
export const NO_SECTION = 'none'
export const NO_SECTION_NAME = 'Other tasks'

/** How close a due time has to be before a task says so. */
const DUE_SOON_MINUTES = 60

export type TaskState = 'done' | 'overdue' | 'due-soon' | 'ongoing' | 'todo'

export const REPEAT_LABELS: Record<TaskRepeat, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export function taskState(task: Task, now: Date): TaskState {
  if (task.status === 'done') return 'done'
  if (task.dueAt) {
    const left = parseISO(task.dueAt).getTime() - now.getTime()
    if (left < 0) return 'overdue'
    if (left <= DUE_SOON_MINUTES * 60_000) return 'due-soon'
  }
  return task.status === 'in_progress' ? 'ongoing' : 'todo'
}

/** "Due 08:30" today, "Due Tue 20 Oct" on any other day. */
export function taskWhen(task: Task): string {
  const clock = (value: string) => format(parseISO(value), isToday(parseISO(value)) ? 'HH:mm' : 'EEE d MMM')
  if (task.status === 'done' && task.completedAt) return `Done ${clock(task.completedAt)}`
  return task.dueAt ? `Due ${clock(task.dueAt)}` : 'No due time'
}

/** Whether a task is still worth listing: finished ones drop off after the day they were done. */
export function isCurrentTask(task: Task, now: Date): boolean {
  if (task.status !== 'done') return true
  return Boolean(task.completedAt) && parseISO(task.completedAt as string) >= startOfDayLocal(now)
}

export function orderedSections(sections: TaskSection[]): TaskSection[] {
  return [...sections].sort((a, b) => a.position - b.position)
}

/** Saved order, with anything added since on top, newest first. */
export function orderedTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.position === undefined && b.position === undefined) return b.createdAt.localeCompare(a.createdAt)
    if (a.position === undefined) return -1
    if (b.position === undefined) return 1
    return a.position - b.position
  })
}

export function byPriority(tasks: Task[]): Task[] {
  const rank = { high: 0, normal: 1, low: 2 }
  return [...tasks].sort(
    (a, b) => rank[a.priority] - rank[b.priority] || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'),
  )
}

/** The section a task shows under, which is none if its section has gone. */
export function sectionKey(task: Task, sections: TaskSection[]): string {
  return task.sectionId && sections.some((section) => section.id === task.sectionId) ? task.sectionId : NO_SECTION
}

/**
 * What goes on the list when a repeating task is finished: the same job, due
 * at the next repeat still ahead. Null if it doesn't repeat, or if ticking it
 * has already made one, so unticking and ticking again never makes two.
 */
export function nextOccurrence(task: Task, tasks: Task[], now = new Date()): Omit<Task, 'id' | 'createdAt'> | null {
  if (!task.repeat || task.repeat === 'none') return null
  if (tasks.some((entry) => entry.repeatOf === task.id)) return null

  const step = { daily: addDays, weekly: addWeeks, monthly: addMonths }[task.repeat]
  let due = task.dueAt ? parseISO(task.dueAt) : now
  do due = step(due, 1)
  while (due <= now)

  const { completedAt: _completedAt, completedBy: _completedBy, photo: _photo, answers: _answers, position: _position, id: _id, createdAt: _createdAt, ...rest } = task
  return { ...rest, status: 'todo', dueAt: due.toISOString(), repeatOf: task.id }
}
