import { useMemo, useState } from 'react'
import { Check, LayoutTemplate, Plus, Search, Settings } from 'lucide-react'
import { useStore } from '@/data/store'
import { TEMPLATE_GROUPS } from '@/data/taskQuestions'
import { createTemplateLibrary } from '@/data/taskTemplateLibrary'
import type { TaskTemplate } from '@/data/types'
import { questionSummary } from '@/lib/taskAnswers'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { MANAGE_TEMPLATES_PATH } from './editing'

const ADDED = 'Added'

function questionCount(template: TaskTemplate): number {
  return template.tasks.reduce((total, task) => total + task.questions.length, 0)
}

/**
 * The template library. Adding one saves it to the venue's own templates,
 * ready to pick when creating a task; it doesn't create any tasks itself.
 */
export function TemplatesPage() {
  const { data, addTaskTemplates } = useStore()
  const toast = useToast()
  // Built once per visit, so a template keeps the same ids between preview and add.
  const [library] = useState(createTemplateLibrary)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<TaskTemplate | null>(null)

  const saved = useMemo(() => new Set(data.taskTemplates.map((template) => template.id)), [data.taskTemplates])
  const addedCount = library.filter((template) => saved.has(template.id)).length

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return library.filter(
      (template) =>
        (filter === null || (filter === ADDED ? saved.has(template.id) : template.group === filter)) &&
        (needle === '' ||
          template.name.toLowerCase().includes(needle) ||
          template.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
          template.tasks.some((task) => task.title.toLowerCase().includes(needle))),
    )
  }, [library, query, filter, saved])

  function add(template: TaskTemplate) {
    addTaskTemplates([structuredClone(template)])
    toast.success(`${template.name} added`, 'Choose it under “Template to use” when you create a task.')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task templates"
        description="Add the templates your venue uses. They’re saved for later: pick one when you create a task, and change their questions in Settings."
        actions={
          <ButtonLink to={MANAGE_TEMPLATES_PATH}>
            <Settings className="size-4" />
            Manage my templates
            {data.taskTemplates.length > 0 ? (
              <span className="bg-surface-muted text-ink-muted rounded-full px-1.5 text-xs tabular-nums">
                {data.taskTemplates.length}
              </span>
            ) : null}
          </ButtonLink>
        }
      />

      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <TextInput
            type="search"
            value={query}
            placeholder="Search templates, tasks or tags"
            aria-label="Search templates"
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div
          role="group"
          aria-label="Filter templates"
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {[null, ADDED, ...TEMPLATE_GROUPS].map((entry) => (
            <button
              key={entry ?? 'all'}
              type="button"
              aria-pressed={filter === entry}
              onClick={() => setFilter(entry)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                filter === entry
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line-default bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {entry === ADDED ? <Check className="size-3.5" /> : null}
              {entry ?? 'All'}
              {entry === ADDED ? <span className="tabular-nums opacity-80">{addedCount}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={filter === ADDED ? <LayoutTemplate className="size-5" /> : <Search className="size-5" />}
            title={filter === ADDED ? 'None added yet' : 'No templates match'}
            description={filter === ADDED ? 'Add templates from the library and they’ll show here.' : 'Try another search or filter.'}
          />
        </Card>
      ) : (
        TEMPLATE_GROUPS.filter((group) => visible.some((template) => template.group === group)).map((group) => {
          const inGroup = visible.filter((template) => template.group === group)
          return (
            <section key={group} aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="text-ink-muted mb-2 px-1 text-[13px] font-semibold">
                {group} <span className="text-ink-subtle font-normal">· {inGroup.length}</span>
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-line divide-y">
                  {inGroup.map((template) => (
                    <LibraryRow
                      key={template.id}
                      template={template}
                      added={saved.has(template.id)}
                      onPreview={() => setPreviewing(template)}
                      onAdd={() => add(template)}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          )
        })
      )}

      {previewing ? (
        <TemplatePreview
          template={previewing}
          added={saved.has(previewing.id)}
          onAdd={() => add(previewing)}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  )
}

function AddButton({ added, onAdd, name }: { added: boolean; onAdd: () => void; name: string }) {
  return added ? (
    <span className="text-pass-700 dark:text-pass-500 flex h-8 shrink-0 items-center gap-1 px-2 text-[13px] font-semibold">
      <Check className="size-4" />
      Added
    </span>
  ) : (
    <Button size="sm" onClick={onAdd} aria-label={`Add ${name} to my templates`} className="shrink-0">
      <Plus className="size-4" />
      Add
    </Button>
  )
}

function LibraryRow({
  template,
  added,
  onPreview,
  onAdd,
}: {
  template: TaskTemplate
  added: boolean
  onPreview: () => void
  onAdd: () => void
}) {
  const questions = questionCount(template)
  return (
    <li className="hover:bg-surface-muted/60 flex items-center gap-2 pr-3 transition-colors sm:pr-4">
      <button type="button" onClick={onPreview} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left sm:pl-5">
        <span className="bg-surface-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-lg" aria-hidden>
          {template.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink block truncate text-sm font-medium">{template.name}</span>
          <span className="text-ink-muted mt-0.5 block truncate text-xs">
            {[
              template.schedule,
              `${template.tasks.length} task${template.tasks.length === 1 ? '' : 's'}`,
              `${questions} question${questions === 1 ? '' : 's'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {template.tags.length > 0 ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </span>
          ) : null}
        </span>
      </button>
      <AddButton added={added} onAdd={onAdd} name={template.name} />
    </li>
  )
}

/** Read-only look inside a library template before adding it. */
function TemplatePreview({
  template,
  added,
  onAdd,
  onClose,
}: {
  template: TaskTemplate
  added: boolean
  onAdd: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${template.icon ? `${template.icon} ` : ''}${template.name}`}
      description={[template.group, template.schedule].filter(Boolean).join(' · ')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {added ? (
            <ButtonLink to={MANAGE_TEMPLATES_PATH} variant="secondary">
              <Check className="size-4" />
              Added · Manage
            </ButtonLink>
          ) : (
            <Button variant="primary" onClick={onAdd}>
              <Plus className="size-4" />
              Add to my templates
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-ink-muted text-sm">
          Once added, every question and option can be changed in Settings → Templates.
        </p>
        {template.tasks.map((task, index) => (
          <section key={task.id}>
            <h3 className="text-ink text-sm font-semibold">
              {template.tasks.length > 1 ? `${index + 1}. ` : ''}
              {task.title}
            </h3>
            <ol className="border-line divide-line mt-2 divide-y rounded-lg border">
              {task.questions.map((question) => (
                <li key={question.id} className="px-3 py-2">
                  <p className="text-ink text-[13px]">{question.label}</p>
                  <p className="text-ink-muted text-xs">{questionSummary(question)}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Modal>
  )
}
