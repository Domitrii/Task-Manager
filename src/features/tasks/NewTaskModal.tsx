import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { newTemplateTask, resolveQuestions } from '@/data/taskQuestions'
import type { AppData, TaskCategory, TaskPriority, TaskTemplate, TemplateTask } from '@/data/types'
import { cn, createId, titleCase } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { QuestionListEditor } from '@/features/templates/QuestionEditor'

const CATEGORIES: TaskCategory[] = ['compliance', 'maintenance', 'prep', 'admin', 'training']

/**
 * A template's tasks as editable drafts for this one go: linked questions are
 * filled from the team's data now, and every id is fresh, so nothing done here
 * changes the saved template.
 */
function draftsFrom(template: TaskTemplate, data: AppData): TemplateTask[] {
  return template.tasks.map((task) => ({
    ...structuredClone(task),
    id: createId('tt'),
    questions: resolveQuestions(task.questions, data),
  }))
}

function questionsLabel(count: number): string {
  return `${count} question${count === 1 ? '' : 's'}`
}

/**
 * Creates one task, or a template's worth. Whatever the template holds can be
 * changed first, for these tasks only: delete tasks, add one, rename them, and
 * change their questions and how each is answered.
 */
export function NewTaskModal({ onClose }: { onClose: () => void }) {
  const { data, activeStaffId, addTasks } = useStore()
  const toast = useToast()
  const [templateId, setTemplateId] = useState('')
  const [drafts, setDrafts] = useState<TemplateTask[]>(() => [newTemplateTask()])
  const [openId, setOpenId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState(activeStaffId)
  const [dueAt, setDueAt] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Only templates with something in them are worth offering.
  const templates = data.taskTemplates.filter((entry) => entry.tasks.length > 0)
  const template = templates.find((entry) => entry.id === templateId)
  const single = drafts.length === 1
  const untitled = drafts.filter((draft) => draft.title.trim() === '')

  function chooseTemplate(id: string) {
    setTemplateId(id)
    const next = templates.find((entry) => entry.id === id)
    setDrafts(next ? draftsFrom(next, data) : [newTemplateTask()])
    setOpenId(null)
    setSubmitted(false)
  }

  function updateDraft(next: TemplateTask) {
    setDrafts((current) => current.map((draft) => (draft.id === next.id ? next : draft)))
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id))
    if (openId === id) setOpenId(null)
  }

  function addDraft() {
    const draft = newTemplateTask()
    setDrafts((current) => [...current, draft])
    setOpenId(draft.id)
  }

  function handleSave() {
    setSubmitted(true)
    if (drafts.length === 0) return
    if (untitled.length > 0) {
      setOpenId(untitled[0].id)
      return
    }
    addTasks(
      drafts.map((draft) => ({
        title: draft.title.trim(),
        description: draft.description?.trim() || undefined,
        priority: draft.priority,
        category: draft.category,
        questions: draft.questions.length > 0 ? draft.questions : undefined,
        assigneeId: assigneeId || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        status: 'todo' as const,
        templateId: template?.id,
      })),
    )
    const assigned = `assigned to ${staffName(data, assigneeId)}`
    if (single) toast.success('Task created', `${template ? `From ${template.name}, ` : ''}${assigned}.`)
    else toast.success(`${drafts.length} tasks created`, `${template ? `From ${template.name}, ` : ''}${assigned}.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New task"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={drafts.length === 0}>
            {single || drafts.length === 0 ? 'Create task' : `Create ${drafts.length} tasks`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
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
              'Change anything below for these tasks only. The saved template stays as it is.'
            ) : (
              'Optional. Fills in the tasks and the questions to answer.'
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

        {single ? (
          <DraftEditor draft={drafts[0]} onChange={updateDraft} submitted={submitted} />
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-ink text-[13px] font-medium">
                {drafts.length === 0 ? 'No tasks left to create' : `Tasks to create (${drafts.length})`}
              </p>
              {template ? (
                <Button size="sm" variant="ghost" onClick={() => chooseTemplate(template.id)} className="gap-1.5">
                  <RotateCcw className="size-3.5" />
                  Reset to template
                </Button>
              ) : null}
            </div>
            {drafts.length > 0 ? (
              <ol className="border-line divide-line divide-y rounded-lg border">
                {drafts.map((draft, index) => (
                  <DraftRow
                    key={draft.id}
                    draft={draft}
                    number={index + 1}
                    open={openId === draft.id}
                    invalid={submitted && draft.title.trim() === ''}
                    onToggle={() => setOpenId(openId === draft.id ? null : draft.id)}
                    onChange={updateDraft}
                    onDelete={() => removeDraft(draft.id)}
                    submitted={submitted}
                  />
                ))}
              </ol>
            ) : (
              <p className="text-ink-muted border-line rounded-lg border border-dashed px-3 py-4 text-center text-[13px]">
                Every task has been removed. Add one, or reset to the template.
              </p>
            )}
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={addDraft} className="gap-1.5">
          <Plus className="size-4" />
          Add {single ? 'another' : 'a'} task
        </Button>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to" hint={single ? undefined : 'For every task above.'} htmlFor="task-assignee">
            <Select id="task-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
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
            <TextInput id="task-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/** One of several tasks to create: a summary line that opens into its editor. */
function DraftRow({
  draft,
  number,
  open,
  invalid,
  onToggle,
  onChange,
  onDelete,
  submitted,
}: {
  draft: TemplateTask
  number: number
  open: boolean
  invalid: boolean
  onToggle: () => void
  onChange: (draft: TemplateTask) => void
  onDelete: () => void
  submitted: boolean
}) {
  const meta = [questionsLabel(draft.questions.length), titleCase(draft.category)]
  if (draft.priority !== 'normal') meta.push(`${titleCase(draft.priority)} priority`)

  return (
    <li>
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-3 text-left"
        >
          <span className="bg-surface-muted text-ink-muted mt-px flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums">
            {number}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-sm font-medium',
                draft.title.trim() ? 'text-ink' : 'text-ink-subtle italic',
                invalid && 'text-fail-600 dark:text-fail-500',
              )}
            >
              {draft.title.trim() || (invalid ? 'Needs a name' : 'Untitled task')}
            </span>
            <span className="text-ink-muted block truncate text-xs">{meta.join(' · ')}</span>
          </span>
          <span className="text-brand-700 dark:text-brand-300 mt-0.5 flex shrink-0 items-center gap-1 text-[13px] font-semibold">
            {open ? 'Done' : 'Edit'}
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </span>
        </button>
        <IconButton label={`Don’t create ${draft.title || 'this task'}`} size="sm" onClick={onDelete}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>
      {open ? (
        <div className="border-line bg-surface-muted/40 border-t px-3 py-4">
          <DraftEditor draft={draft} onChange={onChange} submitted={submitted} />
        </div>
      ) : null}
    </li>
  )
}

/** The task itself and its questions. */
function DraftEditor({
  draft,
  onChange,
  submitted,
}: {
  draft: TemplateTask
  onChange: (draft: TemplateTask) => void
  submitted: boolean
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const set = (changes: Partial<TemplateTask>) => onChange({ ...draft, ...changes })
  const missingTitle = submitted && draft.title.trim() === ''

  return (
    <div className="space-y-4">
      <Field label="Task" required htmlFor={`${draft.id}-title`} error={missingTitle ? 'Give the task a name.' : undefined}>
        <TextInput
          id={`${draft.id}-title`}
          value={draft.title}
          autoFocus={draft.title === ''}
          invalid={missingTitle}
          placeholder="e.g. Book the annual extraction clean"
          onChange={(event) => set({ title: event.target.value })}
        />
      </Field>
      <Field label="Detail" hint="Optional" htmlFor={`${draft.id}-description`}>
        <Textarea
          id={`${draft.id}-description`}
          value={draft.description ?? ''}
          onChange={(event) => set({ description: event.target.value || undefined })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor={`${draft.id}-priority`}>
          <Select
            id={`${draft.id}-priority`}
            value={draft.priority}
            onChange={(event) => set({ priority: event.target.value as TaskPriority })}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>
        <Field label="Category" htmlFor={`${draft.id}-category`}>
          <Select
            id={`${draft.id}-category`}
            value={draft.category}
            onChange={(event) => set({ category: event.target.value as TaskCategory })}
          >
            {CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {titleCase(entry)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <p className="text-ink mb-1 text-sm font-semibold">Questions</p>
        <p className="text-ink-muted mb-3 text-xs">
          What whoever does the task answers. Tap a question to change it or how it’s answered.
        </p>
        <QuestionListEditor
          questions={draft.questions}
          onChange={(questions) => set({ questions })}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </div>
    </div>
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
