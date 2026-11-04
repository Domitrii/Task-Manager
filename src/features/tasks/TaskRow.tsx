import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  CircleAlert,
  GripVertical,
  Repeat,
} from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { REPEAT_LABELS, taskState, taskWhen } from '@/data/tasks'
import type { Task } from '@/data/types'
import { exceptionCount, taskScore } from '@/lib/taskAnswers'
import { cn, titleCase } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { StoredPhoto } from '@/features/temperatures/ReadingPhoto'

/** Whether ticking the task needs more than a tick. */
export function needsRunning(task: Task): boolean {
  return (task.questions?.length ?? 0) > 0 || Boolean(task.photoRequired)
}

export function TaskRow({
  task,
  now,
  onToggle,
  onRun,
}: {
  task: Task
  now: Date
  onToggle: () => void
  onRun: () => void
}) {
  const { data, updateTask } = useStore()
  const [open, setOpen] = useState(false)
  const state = taskState(task, now)
  const done = state === 'done'
  const overdue = state === 'overdue'
  const questions = task.questions?.length ?? 0
  const exceptions = exceptionCount(task)
  const score = taskScore(task)

  return (
    <li className={cn('rounded-xl', overdue && 'bg-fail-50 dark:bg-fail-500/15')}>
      <div className="flex items-start gap-3 p-2.5">
        <button
          type="button"
          aria-label={
            done
              ? 'Reopen task'
              : questions > 0
                ? 'Answer and complete'
                : task.photoRequired
                  ? 'Add a photo and complete'
                  : 'Mark complete'
          }
          onClick={onToggle}
          className={cn(
            'mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors',
            done
              ? 'border-brand-600 bg-brand-600 text-white'
              : overdue
                ? 'border-fail-500 bg-surface/70'
                : 'border-line-strong hover:border-brand-500',
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className={cn('block w-full text-left text-[15px] leading-snug font-medium', done ? 'text-ink-muted' : 'text-ink')}
          >
            {task.title}
          </button>
          <p className="text-ink-muted mt-0.5 text-xs">
            {taskWhen(task)} · {task.assigneeId ? staffName(data, task.assigneeId) : 'Unassigned'}
          </p>
          {overdue ? null : (
            <Badge
              tone={done ? 'pass' : state === 'due-soon' ? 'warn' : 'neutral'}
              className="mt-1.5"
            >
              {done ? '✓ Done' : state === 'due-soon' ? 'Due soon' : state === 'ongoing' ? 'Ongoing' : 'To do'}
            </Badge>
          )}
        </div>

        {overdue ? (
          <span className="text-fail-700 dark:text-fail-500 mt-1.5 flex shrink-0 items-center gap-1 text-xs font-semibold">
            <CircleAlert className="size-4" />
            Overdue
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-2.5 px-2.5 pb-3">
          {task.description ? <p className="text-ink-muted text-[13px] leading-relaxed">{task.description}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{titleCase(task.category)}</Badge>
            {task.priority === 'high' ? <Badge tone="fail">High priority</Badge> : null}
            {task.repeat && task.repeat !== 'none' ? (
              <Badge icon={<Repeat className="size-3" />}>{REPEAT_LABELS[task.repeat]}</Badge>
            ) : null}
            {task.photoRequired ? <Badge icon={<Camera className="size-3" />}>Photo required</Badge> : null}
            {questions > 0 ? (
              <Badge tone="info">
                {questions} question{questions === 1 ? '' : 's'}
              </Badge>
            ) : null}
            {exceptions > 0 ? (
              <Badge tone="fail">
                {exceptions} exception{exceptions === 1 ? '' : 's'}
              </Badge>
            ) : null}
            {score && done ? (
              <Badge tone="brand">
                Score {score.score}/{score.max}
              </Badge>
            ) : null}
          </div>
          {task.photo ? <StoredPhoto path={task.photo} size="lg" /> : null}
          <div className="flex flex-wrap gap-2">
            {questions > 0 || task.photoRequired ? (
              <Button size="sm" onClick={onRun}>
                {done ? 'See answers' : questions > 0 ? 'Answer questions' : 'Add photo'}
              </Button>
            ) : null}
            {!done ? (
              <Button
                size="sm"
                onClick={() => updateTask(task.id, { status: task.status === 'in_progress' ? 'todo' : 'in_progress' })}
              >
                {task.status === 'in_progress' ? 'Move back to to do' : 'Mark as ongoing'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

/** A task in edit mode: the same row, with the way to take it off the list. */
export function EditableTaskRow({ task, now, onRemove }: { task: Task; now: Date; onRemove: () => void }) {
  const { data } = useStore()
  const overdue = taskState(task, now) === 'overdue'
  return (
    <li>
      <div className={cn('rounded-xl p-2.5', overdue && 'bg-fail-50 dark:bg-fail-500/15')}>
        <p className="text-ink text-[15px] leading-snug font-medium">{task.title}</p>
        <p className="text-ink-muted mt-0.5 text-xs">
          {taskWhen(task)} · {task.assigneeId ? staffName(data, task.assigneeId) : 'Unassigned'}
        </p>
      </div>
      <Button size="sm" onClick={onRemove} className="mt-1.5 ml-1">
        Remove task
      </Button>
    </li>
  )
}

/** A task in reorder mode: its handle and arrows above it. */
export function ReorderTaskRow({
  task,
  now,
  scope,
  drag,
  onMove,
}: {
  task: Task
  now: Date
  scope: string
  drag: ReturnType<(scope: string, id: string) => object>
  onMove: (step: -1 | 1) => void
}) {
  const { data } = useStore()
  const overdue = taskState(task, now) === 'overdue'
  return (
    <li data-drag={scope} data-drag-id={task.id}>
      <div className="flex items-center gap-1">
        <span
          {...drag}
          className="text-ink-subtle flex size-9 cursor-grab touch-none items-center justify-center"
          aria-hidden
        >
          <GripVertical className="size-5" />
        </span>
        <IconButton label={`Move ${task.title} up`} size="sm" onClick={() => onMove(-1)}>
          <ArrowUp className="size-4" />
        </IconButton>
        <IconButton label={`Move ${task.title} down`} size="sm" onClick={() => onMove(1)}>
          <ArrowDown className="size-4" />
        </IconButton>
      </div>
      <div className={cn('rounded-xl p-2.5', overdue && 'bg-fail-50 dark:bg-fail-500/15')}>
        <p className="text-ink text-[15px] leading-snug font-medium">{task.title}</p>
        <p className="text-ink-muted mt-0.5 text-xs">
          {taskWhen(task)} · {task.assigneeId ? staffName(data, task.assigneeId) : 'Unassigned'}
        </p>
      </div>
    </li>
  )
}
