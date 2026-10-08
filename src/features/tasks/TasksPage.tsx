import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isPast, parseISO } from 'date-fns'
import { CalendarClock, CheckCircle2, ListChecks, Plus, Trash2 } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ID, TaskCategory, TaskPriority, TaskStatus, TaskTemplate } from '@/data/types'
import { formatRelativeDay } from '@/lib/format'
import { exceptionCount, taskScore } from '@/lib/taskAnswers'
import { cn, titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Checkbox, Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TaskRunModal } from './TaskRunModal'

type TabKey = 'open' | 'mine' | 'done'

const CATEGORIES: TaskCategory[] = ['compliance', 'maintenance', 'prep', 'admin', 'training']

export function TasksPage() {
  const { data, activeStaffId, updateTask, deleteTask } = useStore()
  const [tab, setTab] = useState<TabKey>('open')
  const [adding, setAdding] = useState(false)
  // By id, so the sheet always shows the task as it is in the store.
  const [runningId, setRunningId] = useState<ID | null>(null)
  const running = data.tasks.find((task) => task.id === runningId)

  const open = useMemo(() => data.tasks.filter((task) => task.status !== 'done'), [data.tasks])
  const mine = useMemo(() => open.filter((task) => task.assigneeId === activeStaffId), [open, activeStaffId])
  const done = useMemo(() => data.tasks.filter((task) => task.status === 'done'), [data.tasks])
  const overdue = open.filter((task) => task.dueAt && isPast(parseISO(task.dueAt)))

  const visible = tab === 'open' ? open : tab === 'mine' ? mine : done

  const sorted = useMemo(
    () =>
      [...visible].sort((a, b) => {
        const priorityRank = { high: 0, normal: 1, low: 2 }
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority]
        }
        return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
      }),
    [visible],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="Everything that needs doing away from the pass: engineer visits, training, paperwork and prep."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="size-4" />
            New task
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Open tasks" value={open.length} sublabel="Across the whole team" icon={<ListChecks className="size-4" />} />
        <StatCard
          label="Past due"
          value={overdue.length}
          sublabel={overdue.length > 0 ? 'Needs rescheduling or doing' : 'Nothing overdue'}
          icon={<CalendarClock className="size-4" />}
          tone={overdue.length > 0 ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Assigned to me"
          value={mine.length}
          sublabel={staffName(data, activeStaffId)}
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatCard label="Completed" value={done.length} sublabel="All time" icon={<CheckCircle2 className="size-4" />} tone="pass" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'open', label: 'Open', count: open.length },
              { value: 'mine', label: 'Assigned to me', count: mine.length },
              { value: 'done', label: 'Completed', count: done.length },
            ]}
          />
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title="Nothing here"
            description={tab === 'done' ? 'No tasks have been completed yet.' : 'No outstanding tasks.'}
          />
        ) : (
          <ul className="divide-line divide-y">
            {sorted.map((task) => {
              const isOverdue = task.status !== 'done' && task.dueAt && isPast(parseISO(task.dueAt))
              const questionCount = task.questions?.length ?? 0
              const exceptions = exceptionCount(task)
              const score = taskScore(task)
              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <button
                    type="button"
                    aria-label={task.status === 'done' ? 'Reopen task' : questionCount > 0 ? 'Answer and complete' : 'Mark complete'}
                    onClick={() =>
                      // Questions have to be answered first, so ticking one off opens them.
                      task.status !== 'done' && questionCount > 0
                        ? setRunningId(task.id)
                        : updateTask(task.id, {
                            status: task.status === 'done' ? 'todo' : 'done',
                            completedAt: task.status === 'done' ? undefined : new Date().toISOString(),
                          })
                    }
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      task.status === 'done'
                        ? 'border-pass-600 bg-pass-600 text-white'
                        : 'border-line-strong hover:border-brand-500',
                    )}
                  >
                    {task.status === 'done' ? <CheckCircle2 className="size-3.5" /> : null}
                  </button>

                  <div className="min-w-0 flex-1">
                    {questionCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setRunningId(task.id)}
                        className={cn(
                          'hover:text-brand-700 dark:hover:text-brand-300 text-left text-sm font-medium underline-offset-2 hover:underline',
                          task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
                        )}
                      >
                        {task.title}
                      </button>
                    ) : (
                      <p
                        className={cn(
                          'text-sm font-medium',
                          task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink',
                        )}
                      >
                        {task.title}
                      </p>
                    )}
                    {task.description ? (
                      <p className="text-ink-muted mt-0.5 text-[13px]">{task.description}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-ink-subtle flex items-center gap-1.5 text-[11px]">
                        <Avatar
                          person={data.staff.find((person) => person.id === task.assigneeId)}
                          size="xs"
                        />
                        {staffName(data, task.assigneeId)}
                      </span>
                      {task.dueAt ? (
                        <span
                          className={cn(
                            'text-[11px]',
                            isOverdue ? 'text-fail-600 dark:text-fail-500 font-medium' : 'text-ink-subtle',
                          )}
                        >
                          Due {formatRelativeDay(task.dueAt)}
                        </span>
                      ) : null}
                      <Badge tone="neutral">{titleCase(task.category)}</Badge>
                      {questionCount > 0 ? (
                        <Badge tone="info">
                          {questionCount} question{questionCount === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                      {exceptions > 0 ? (
                        <Badge tone="fail">
                          {exceptions} exception{exceptions === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                      {score && task.status === 'done' ? (
                        <Badge tone="brand">
                          Score {score.score}/{score.max}
                        </Badge>
                      ) : null}
                      {task.priority === 'high' ? <Badge tone="fail">High priority</Badge> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {task.status !== 'done' ? (
                      <Select
                        value={task.status}
                        aria-label="Task status"
                        className="h-8 w-auto min-w-32 text-[13px]"
                        onChange={(event) =>
                          updateTask(task.id, { status: event.target.value as TaskStatus })
                        }
                      >
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </Select>
                    ) : null}
                    <IconButton label="Delete task" size="sm" onClick={() => deleteTask(task.id)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <NewTaskModal open={adding} onClose={() => setAdding(false)} />
      {running ? <TaskRunModal key={running.id} task={running} onClose={() => setRunningId(null)} /> : null}
    </div>
  )
}

export function NewTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, activeStaffId, addTask, addTasks } = useStore()
  const toast = useToast()
  const [templateId, setTemplateId] = useState('')
  const [picked, setPicked] = useState<Set<ID>>(new Set())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState(activeStaffId)
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [category, setCategory] = useState<TaskCategory>('compliance')

  // Only templates with something in them are worth offering.
  const templates = data.taskTemplates.filter((entry) => entry.tasks.length > 0)
  const template = templates.find((entry) => entry.id === templateId)
  // A template with several tasks adds each of them; with one, it fills in this form.
  const several = template !== undefined && template.tasks.length > 1
  const chosen = several ? template.tasks.filter((task) => picked.has(task.id)) : []
  const canSave = several ? chosen.length > 0 : title.trim() !== ''

  function chooseTemplate(id: string) {
    setTemplateId(id)
    const next = templates.find((entry) => entry.id === id)
    if (!next) return
    setPicked(new Set(next.tasks.map((task) => task.id)))
    if (next.tasks.length === 1) {
      const [task] = next.tasks
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setCategory(task.category)
    }
  }

  function togglePicked(id: ID, on: boolean) {
    const next = new Set(picked)
    if (on) next.add(id)
    else next.delete(id)
    setPicked(next)
  }

  function reset() {
    setTemplateId('')
    setTitle('')
    setDescription('')
    setDueAt('')
  }

  function handleSave() {
    if (!canSave) return
    const shared = {
      assigneeId: assigneeId || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      status: 'todo' as const,
      templateId: template?.id,
    }
    if (several) {
      addTasks(
        chosen.map((task) => ({
          ...shared,
          title: task.title.trim() || 'Untitled task',
          description: task.description?.trim() || undefined,
          priority: task.priority,
          category: task.category,
          // Each task gets its own copy, so editing the template later leaves it alone.
          questions: structuredClone(task.questions),
        })),
      )
      toast.success(`${chosen.length} tasks created`, `From ${template.name}, assigned to ${staffName(data, assigneeId)}.`)
    } else {
      addTask({
        ...shared,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category,
        questions: template ? structuredClone(template.tasks[0].questions) : undefined,
      })
      toast.success('Task created', `Assigned to ${staffName(data, assigneeId)}.`)
    }
    reset()
    onClose()
  }

  const questionCount = template && !several ? template.tasks[0].questions.length : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {several ? `Create ${chosen.length} task${chosen.length === 1 ? '' : 's'}` : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Template to use"
          hint={
            templates.length === 0 ? (
              <>
                Optional. No saved templates yet:{' '}
                <Link to="/templates" onClick={onClose} className="text-brand-700 dark:text-brand-300 font-medium underline">
                  add some from the library
                </Link>
                .
              </>
            ) : template ? (
              several ? (
                `Creates a task for each one you tick, each with its own questions.`
              ) : (
                `Adds ${questionCount} question${questionCount === 1 ? '' : 's'} to answer when completing the task.`
              )
            ) : (
              'Optional. Fills in the task and the questions to answer.'
            )
          }
          htmlFor="task-template"
        >
          <Select
            id="task-template"
            value={templateId}
            disabled={templates.length === 0}
            onChange={(event) => chooseTemplate(event.target.value)}
          >
            <option value="">No template</option>
            {templateGroups(templates).map(([group, entries]) => (
              <optgroup key={group} label={group}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.icon ? `${entry.icon} ` : ''}
                    {entry.name || 'Untitled template'}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        {several ? (
          <div>
            <p className="text-ink mb-1.5 text-[13px] font-medium">Tasks to create</p>
            <ul className="border-line divide-line divide-y rounded-lg border">
              {template.tasks.map((task) => (
                <li key={task.id} className="px-3 py-2.5">
                  <Checkbox
                    label={task.title || 'Untitled task'}
                    description={`${task.questions.length} question${task.questions.length === 1 ? '' : 's'}`}
                    checked={picked.has(task.id)}
                    onChange={(event) => togglePicked(task.id, event.target.checked)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <Field label="Task" required htmlFor="task-title">
              <TextInput
                id="task-title"
                value={title}
                autoFocus
                placeholder="e.g. Book the annual extraction clean"
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Detail" hint="Optional" htmlFor="task-description">
              <Textarea
                id="task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to" htmlFor="task-assignee">
            <Select
              id="task-assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {data.staff
                .filter((person) => person.active)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Due" hint="Optional" htmlFor="task-due">
            <TextInput
              id="task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
          {several ? null : (
            <>
              <Field label="Priority" htmlFor="task-priority">
                <Select
                  id="task-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </Select>
              </Field>
              <Field label="Category" htmlFor="task-category">
                <Select
                  id="task-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TaskCategory)}
                >
                  {CATEGORIES.map((entry) => (
                    <option key={entry} value={entry}>
                      {titleCase(entry)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Saved templates under their groups, for the picker. */
function templateGroups(templates: TaskTemplate[]): [string, TaskTemplate[]][] {
  const groups = new Map<string, TaskTemplate[]>()
  for (const template of templates) {
    const list = groups.get(template.group)
    if (list) list.push(template)
    else groups.set(template.group, [template])
  }
  return [...groups]
}
