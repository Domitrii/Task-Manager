import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  LayoutTemplate,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useStore } from '@/data/store'
import { newTemplateTask, TEMPLATE_GROUPS } from '@/data/taskTemplateLibrary'
import type { TaskCategory, TaskPriority, TaskTemplate, TemplateTask } from '@/data/types'
import { questionSummary } from '@/lib/taskAnswers'
import { cn, createId, titleCase } from '@/lib/utils'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { AssignTemplateModal } from './AssignTemplateModal'
import { copyQuestion, move, questionAnchor } from './editing'
import { QuestionListEditor } from './QuestionEditor'

const CATEGORIES: TaskCategory[] = ['compliance', 'maintenance', 'prep', 'admin', 'training']
const SAVE_DELAY_MS = 400

type Update = (recipe: (template: TaskTemplate) => TaskTemplate) => void

/**
 * A template being edited, saved a moment after each change and whenever the
 * editor closes. Typing goes into the draft rather than the store, so the
 * rest of the app doesn't re-render (and sync doesn't send) on every key.
 */
function useTemplateDraft(stored: TaskTemplate) {
  const { saveTaskTemplate } = useStore()
  const [draft, setDraft] = useState(stored)
  const pending = useRef<TaskTemplate | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const save = useRef(saveTaskTemplate)
  useEffect(() => {
    save.current = saveTaskTemplate
  }, [saveTaskTemplate])

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current) save.current(pending.current)
    pending.current = null
  }, [])

  // Leaving the editor saves whatever hasn't been yet.
  useEffect(() => flush, [flush])

  const update = useCallback<Update>(
    (recipe) => {
      setDraft((current) => {
        const next = recipe(current)
        pending.current = next
        return next
      })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush],
  )

  /** Drops unsaved changes, e.g. when the template is being deleted. */
  const discard = useCallback(() => {
    window.clearTimeout(timer.current)
    pending.current = null
  }, [])

  return { draft, update, discard }
}

/** `/templates/:templateId/*` — the template's overview, or one of its tasks. */
export function TemplateEditorRoute() {
  const { templateId } = useParams()
  const { data } = useStore()
  const stored = data.taskTemplates.find((template) => template.id === templateId)

  if (!stored) {
    return (
      <Card>
        <EmptyState
          icon={<LayoutTemplate className="size-5" />}
          title="Template not found"
          description="It may have been deleted on another device."
          action={<ButtonLink to="/templates">Back to templates</ButtonLink>}
        />
      </Card>
    )
  }
  // Keyed, so opening another template starts a fresh draft.
  return <TemplateEditor key={stored.id} stored={stored} />
}

function TemplateEditor({ stored }: { stored: TaskTemplate }) {
  const { draft, update, discard } = useTemplateDraft(stored)
  return (
    <Routes>
      <Route index element={<TemplateOverview template={draft} update={update} discard={discard} />} />
      <Route path="tasks/:taskId" element={<TemplateTaskEditor template={draft} update={update} />} />
      <Route path="*" element={<Navigate to={`/templates/${draft.id}`} replace />} />
    </Routes>
  )
}

function Breadcrumbs({ trail }: { trail: { label: string; to: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-ink-muted flex min-w-0 items-center gap-1 text-[13px]">
      {trail.map((entry, index) => (
        <span key={entry.to} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight className="text-ink-subtle size-3.5 shrink-0" /> : <ChevronLeft className="size-3.5 shrink-0" />}
          <Link to={entry.to} className="hover:text-ink truncate font-medium">
            {entry.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}

function templateTitle(template: TaskTemplate): string {
  return template.name.trim() || 'Untitled template'
}

/* Overview ------------------------------------------------------------------ */

function TemplateOverview({
  template,
  update,
  discard,
}: {
  template: TaskTemplate
  update: Update
  discard: () => void
}) {
  const { saveTaskTemplate, deleteTaskTemplate } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [assigning, setAssigning] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Kept as typed, so a trailing comma survives until the next tag is written.
  const [tagText, setTagText] = useState(template.tags.join(', '))

  const set = (changes: Partial<TaskTemplate>) => update((current) => ({ ...current, ...changes }))
  const setTasks = (recipe: (tasks: TemplateTask[]) => TemplateTask[]) =>
    update((current) => ({ ...current, tasks: recipe(current.tasks) }))
  const groups = TEMPLATE_GROUPS.includes(template.group as (typeof TEMPLATE_GROUPS)[number])
    ? TEMPLATE_GROUPS
    : [...TEMPLATE_GROUPS, template.group]

  function addTask() {
    const task = newTemplateTask()
    setTasks((tasks) => [...tasks, task])
    navigate(`tasks/${task.id}`)
  }

  function duplicateTask(index: number) {
    const original = template.tasks[index]
    const copy: TemplateTask = {
      ...original,
      id: createId('tt'),
      title: `${original.title} (copy)`,
      questions: original.questions.map(copyQuestion),
    }
    setTasks((tasks) => [...tasks.slice(0, index + 1), copy, ...tasks.slice(index + 1)])
  }

  function duplicateTemplate() {
    const copy: TaskTemplate = {
      ...structuredClone(template),
      id: createId('tp'),
      name: `${templateTitle(template)} (copy)`,
    }
    copy.tasks = copy.tasks.map((task) => ({ ...task, id: createId('tt'), questions: task.questions.map(copyQuestion) }))
    saveTaskTemplate(copy)
    toast.success('Template duplicated', 'You’re now editing the copy.')
    navigate(`/templates/${copy.id}`)
  }

  function deleteTemplate() {
    discard()
    deleteTaskTemplate(template.id)
    toast.success('Template deleted', 'Tasks already added from it stay on people’s lists.')
    navigate('/templates', { replace: true })
  }

  return (
    <div className="space-y-5">
      <Breadcrumbs trail={[{ label: 'Task templates', to: '/templates' }]} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-surface-muted flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl" aria-hidden>
            {template.icon || <LayoutTemplate className="text-ink-subtle size-5" />}
          </span>
          <div className="min-w-0">
            <h1 className={cn('text-xl font-semibold tracking-tight sm:text-2xl', template.name ? 'text-ink' : 'text-ink-subtle italic')}>
              {templateTitle(template)}
            </h1>
            <p className="text-ink-muted mt-0.5 text-sm">
              {[template.group, template.schedule].filter(Boolean).join(' · ')} · Changes save automatically
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="primary" onClick={() => setAssigning(true)} disabled={template.tasks.length === 0}>
            <UserPlus className="size-4" />
            Add to someone’s tasks
          </Button>
          <Menu
            trigger={({ toggle }) => (
              <IconButton label="Template actions" variant="secondary" onClick={toggle}>
                <Ellipsis className="size-4" />
              </IconButton>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem icon={<Copy className="size-4" />} onClick={() => { duplicateTemplate(); close() }}>
                  Duplicate template
                </MenuItem>
                <MenuDivider />
                <MenuItem tone="danger" icon={<Trash2 className="size-4" />} onClick={() => { setConfirmingDelete(true); close() }}>
                  Delete template
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_22rem]">
        <Card className="xl:order-2">
          <CardHeader title="Details" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-[4.5rem_1fr] gap-3">
              <Field label="Icon" htmlFor="template-icon">
                <TextInput
                  id="template-icon"
                  value={template.icon ?? ''}
                  placeholder="🔎"
                  maxLength={4}
                  className="text-center text-lg"
                  onChange={(event) => set({ icon: event.target.value.trim() || undefined })}
                />
              </Field>
              <Field label="Name" htmlFor="template-name">
                <TextInput
                  id="template-name"
                  value={template.name}
                  autoFocus={!template.name}
                  placeholder="e.g. Opening Checks - Kitchen"
                  onChange={(event) => set({ name: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Group" hint="Templates are listed under their group." htmlFor="template-group">
              <Select id="template-group" value={template.group} onChange={(event) => set({ group: event.target.value })}>
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Schedule" hint="Optional. When it’s meant to happen, in words." htmlFor="template-schedule">
              <TextInput
                id="template-schedule"
                value={template.schedule ?? ''}
                placeholder="e.g. Every day in Open"
                onChange={(event) => set({ schedule: event.target.value || undefined })}
              />
            </Field>
            <Field label="Tags" hint="Separate with commas." htmlFor="template-tags">
              <TextInput
                id="template-tags"
                value={tagText}
                placeholder="e.g. Food Safety, Kitchen"
                onChange={(event) => {
                  setTagText(event.target.value)
                  set({ tags: [...new Set(event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))] })
                }}
              />
            </Field>
          </CardBody>
        </Card>

        <Card className="overflow-hidden xl:order-1">
          <CardHeader
            title={`Tasks (${template.tasks.length})`}
            description="Each one goes on the list as its own task. Open a task to change its questions."
            action={
              <Button size="sm" onClick={addTask}>
                <Plus className="size-4" />
                Add task
              </Button>
            }
          />
          {template.tasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Add the first task, then give it some questions." />
          ) : (
            <ol className="divide-line divide-y">
              {template.tasks.map((task, index) => (
                <li key={task.id} className="hover:bg-surface-muted/60 flex items-center gap-1 pr-2 transition-colors sm:pr-3">
                  <Link to={`tasks/${task.id}`} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 sm:pl-5">
                    <span className="bg-surface-muted text-ink-muted mt-px flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm font-medium', task.title ? 'text-ink' : 'text-ink-subtle italic')}>
                        {task.title || 'Untitled task'}
                      </span>
                      <span className="text-ink-muted mt-0.5 block truncate text-xs">
                        {task.questions.length} question{task.questions.length === 1 ? '' : 's'} · {titleCase(task.category)}
                        {task.priority === 'high' ? ' · High priority' : ''}
                      </span>
                    </span>
                  </Link>
                  <Menu
                    trigger={({ toggle }) => (
                      <IconButton label={`Actions for task ${index + 1}`} size="sm" onClick={toggle}>
                        <Ellipsis className="size-4" />
                      </IconButton>
                    )}
                  >
                    {({ close }) => (
                      <>
                        {index > 0 ? (
                          <MenuItem icon={<ArrowUp className="size-4" />} onClick={() => { setTasks((tasks) => move(tasks, index, -1)); close() }}>
                            Move up
                          </MenuItem>
                        ) : null}
                        {index < template.tasks.length - 1 ? (
                          <MenuItem icon={<ArrowDown className="size-4" />} onClick={() => { setTasks((tasks) => move(tasks, index, 1)); close() }}>
                            Move down
                          </MenuItem>
                        ) : null}
                        <MenuItem icon={<Copy className="size-4" />} onClick={() => { duplicateTask(index); close() }}>
                          Duplicate
                        </MenuItem>
                        <MenuDivider />
                        <MenuItem
                          tone="danger"
                          icon={<Trash2 className="size-4" />}
                          onClick={() => { setTasks((tasks) => tasks.filter((entry) => entry.id !== task.id)); close() }}
                        >
                          Delete task
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                  <Link to={`tasks/${task.id}`} aria-hidden tabIndex={-1} className="text-ink-subtle p-1">
                    <ChevronRight className="size-4" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {assigning ? <AssignTemplateModal template={template} onClose={() => setAssigning(false)} /> : null}

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this template?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteTemplate}>
              Delete template
            </Button>
          </>
        }
      >
        <p className="text-ink-muted text-sm">
          {templateTitle(template)} and its {template.tasks.length} task{template.tasks.length === 1 ? '' : 's'} will be
          removed. Tasks already added to people’s lists from it are kept.
        </p>
      </Modal>
    </div>
  )
}

/* One task ------------------------------------------------------------------ */

function TemplateTaskEditor({ template, update }: { template: TaskTemplate; update: Update }) {
  const { taskId } = useParams()
  const index = template.tasks.findIndex((task) => task.id === taskId)
  const task = template.tasks[index]
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(task?.questions.slice(0, 1).map((question) => question.id)))

  // Moving to the next task opens its first question, like opening it fresh.
  const [shownTaskId, setShownTaskId] = useState(taskId)
  if (shownTaskId !== taskId) {
    setShownTaskId(taskId)
    setExpanded(new Set(task?.questions.slice(0, 1).map((question) => question.id)))
  }

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [taskId])

  if (!task) return <Navigate to={`/templates/${template.id}`} replace />

  const setTask = (changes: Partial<TemplateTask>) =>
    update((current) => ({
      ...current,
      tasks: current.tasks.map((entry) => (entry.id === task.id ? { ...entry, ...changes } : entry)),
    }))

  const previous = template.tasks[index - 1]
  const next = template.tasks[index + 1]

  function jumpTo(id: string) {
    setExpanded(new Set(expanded).add(id))
    requestAnimationFrame(() =>
      document.getElementById(questionAnchor(id))?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    )
  }

  return (
    <div className="space-y-5">
      <Breadcrumbs
        trail={[
          { label: 'Task templates', to: '/templates' },
          { label: templateTitle(template), to: `/templates/${template.id}` },
        ]}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink-muted text-[13px] font-medium">
            Task {index + 1} of {template.tasks.length}
          </p>
          <h1 className={cn('text-xl font-semibold tracking-tight sm:text-2xl', task.title ? 'text-ink' : 'text-ink-subtle italic')}>
            {task.title || 'Untitled task'}
          </h1>
        </div>
        <TaskStepper templateId={template.id} previous={previous} next={next} />
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_1fr]">
        <QuestionOutline task={task} onJump={jumpTo} />

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Task" />
            <CardBody className="space-y-4">
              <Field label="Title" htmlFor="task-title">
                <TextInput
                  id="task-title"
                  value={task.title}
                  autoFocus={!task.title}
                  placeholder="e.g. Kitchen opening checks"
                  onChange={(event) => setTask({ title: event.target.value })}
                />
              </Field>
              <Field label="Detail" hint="Optional. Shown on the task." htmlFor="task-description">
                <Textarea
                  id="task-description"
                  value={task.description ?? ''}
                  onChange={(event) => setTask({ description: event.target.value || undefined })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="task-category">
                  <Select
                    id="task-category"
                    value={task.category}
                    onChange={(event) => setTask({ category: event.target.value as TaskCategory })}
                  >
                    {CATEGORIES.map((entry) => (
                      <option key={entry} value={entry}>
                        {titleCase(entry)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority" htmlFor="task-priority">
                  <Select
                    id="task-priority"
                    value={task.priority}
                    onChange={(event) => setTask({ priority: event.target.value as TaskPriority })}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>

          <section aria-labelledby="questions-heading">
            <h2 id="questions-heading" className="text-ink mb-2 text-[15px] font-semibold">
              Questions
            </h2>
            <QuestionListEditor
              questions={task.questions}
              onChange={(questions) => setTask({ questions })}
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
          </section>

          <div className="border-line flex items-center justify-between gap-3 border-t pt-4">
            <ButtonLink to={`/templates/${template.id}`} variant="ghost">
              <ChevronLeft className="size-4" />
              All tasks
            </ButtonLink>
            <TaskStepper templateId={template.id} previous={previous} next={next} labelled />
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskStepper({
  templateId,
  previous,
  next,
  labelled,
}: {
  templateId: string
  previous?: TemplateTask
  next?: TemplateTask
  labelled?: boolean
}) {
  const link = (task: TemplateTask) => `/templates/${templateId}/tasks/${task.id}`
  if (labelled) {
    return (
      <div className="flex items-center gap-2">
        {previous ? (
          <ButtonLink to={link(previous)} size="sm">
            <ChevronLeft className="size-4" />
            Previous
          </ButtonLink>
        ) : null}
        {next ? (
          <ButtonLink to={link(next)} size="sm" variant="primary">
            Next task
            <ChevronRight className="size-4" />
          </ButtonLink>
        ) : null}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1">
      {previous ? (
        <Link to={link(previous)} aria-label="Previous task" title="Previous task" className="border-line-default bg-surface text-ink hover:bg-surface-muted flex size-10 items-center justify-center rounded-lg border">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className="border-line text-ink-subtle flex size-10 items-center justify-center rounded-lg border opacity-50" aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {next ? (
        <Link to={link(next)} aria-label="Next task" title="Next task" className="border-line-default bg-surface text-ink hover:bg-surface-muted flex size-10 items-center justify-center rounded-lg border">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className="border-line text-ink-subtle flex size-10 items-center justify-center rounded-lg border opacity-50" aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  )
}

/** Jump list of the task's questions: a sticky column on desktop, a select on phones. */
function QuestionOutline({ task, onJump }: { task: TemplateTask; onJump: (id: string) => void }) {
  if (task.questions.length === 0) return <div className="hidden lg:block" />
  return (
    <>
      <div className="lg:hidden">
        <Select aria-label="Jump to question" value="" onChange={(event) => event.target.value && onJump(event.target.value)}>
          <option value="">Jump to a question…</option>
          {task.questions.map((question, index) => (
            <option key={question.id} value={question.id}>
              {index + 1}. {question.label || 'Untitled question'}
            </option>
          ))}
        </Select>
      </div>
      <nav aria-label="Questions" className="sticky top-20 hidden lg:block">
        <p className="text-ink-subtle mb-1.5 px-2 text-[13px] font-medium">Questions</p>
        <ol className="space-y-0.5">
          {task.questions.map((question, index) => (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onJump(question.id)}
                title={questionSummary(question)}
                className="hover:bg-surface-muted text-ink-muted hover:text-ink flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]"
              >
                <span className="text-ink-subtle w-4 shrink-0 text-right tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{question.label || 'Untitled question'}</span>
                {question.mandatory ? (
                  <span className="text-fail-600" title="Mandatory">
                    *
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
