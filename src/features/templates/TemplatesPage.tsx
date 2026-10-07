import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Ellipsis, LayoutTemplate, LibraryBig, Plus, Search, UserPlus } from 'lucide-react'
import { useStore } from '@/data/store'
import { createTemplateLibrary, newTemplateTask, TEMPLATE_GROUPS } from '@/data/taskTemplateLibrary'
import type { TaskTemplate } from '@/data/types'
import { cn, createId } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextInput } from '@/components/ui/Field'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { AssignTemplateModal } from './AssignTemplateModal'

/** Groups in day order, then any a venue made up, alphabetically. */
function orderGroups(groups: Iterable<string>): string[] {
  const known: readonly string[] = TEMPLATE_GROUPS
  return [...new Set(groups)].sort((a, b) => {
    const left = known.indexOf(a)
    const right = known.indexOf(b)
    if (left !== -1 || right !== -1) return (left === -1 ? Infinity : left) - (right === -1 ? Infinity : right)
    return a.localeCompare(b)
  })
}

function questionCount(template: TaskTemplate): number {
  return template.tasks.reduce((total, task) => total + task.questions.length, 0)
}

export function TemplatesPage() {
  const { data, saveTaskTemplate, addTaskTemplates } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<TaskTemplate | null>(null)

  const templates = data.taskTemplates
  const groups = useMemo(() => orderGroups(templates.map((template) => template.group)), [templates])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return templates.filter(
      (template) =>
        (group === null || template.group === group) &&
        (needle === '' ||
          template.name.toLowerCase().includes(needle) ||
          template.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
          template.tasks.some((task) => task.title.toLowerCase().includes(needle))),
    )
  }, [templates, query, group])

  const missingFromLibrary = useMemo(() => {
    const have = new Set(templates.map((template) => template.id))
    return createTemplateLibrary().filter((template) => !have.has(template.id))
  }, [templates])

  function addLibrary() {
    addTaskTemplates(missingFromLibrary)
    toast.success(
      `${missingFromLibrary.length} template${missingFromLibrary.length === 1 ? '' : 's'} added`,
      'Open any of them to change its tasks and questions.',
    )
  }

  function createTemplate() {
    const template: TaskTemplate = {
      id: createId('tp'),
      name: '',
      group: group ?? 'Ad hoc',
      tags: [],
      tasks: [newTemplateTask()],
    }
    saveTaskTemplate(template)
    navigate(`/templates/${template.id}`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task templates"
        description="Ready-made sets of tasks. Change any question or option, then add the tasks to someone’s list."
        actions={
          <>
            <Button variant="primary" onClick={createTemplate}>
              <Plus className="size-4" />
              New template
            </Button>
            {templates.length > 0 && missingFromLibrary.length > 0 ? (
              <Menu
                trigger={({ toggle }) => (
                  <IconButton label="More template actions" variant="secondary" onClick={toggle}>
                    <Ellipsis className="size-4" />
                  </IconButton>
                )}
              >
                {({ close }) => (
                  <MenuItem
                    icon={<LibraryBig className="size-4" />}
                    description={`${missingFromLibrary.length} you don’t have yet`}
                    onClick={() => {
                      addLibrary()
                      close()
                    }}
                  >
                    Add starter templates
                  </MenuItem>
                )}
              </Menu>
            ) : null}
          </>
        }
      />

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutTemplate className="size-5" />}
            title="No templates yet"
            description={`Start from the library of ${missingFromLibrary.length} templates: opening and closing checks, temperature records, audits and incident forms. Every one can be edited.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={addLibrary}>
                  <LibraryBig className="size-4" />
                  Add starter templates
                </Button>
                <Button onClick={createTemplate}>Start from scratch</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
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
              aria-label="Filter by group"
              className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            >
              {[null, ...groups].map((entry) => (
                <button
                  key={entry ?? 'all'}
                  type="button"
                  aria-pressed={group === entry}
                  onClick={() => setGroup(entry)}
                  className={cn(
                    'flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                    group === entry
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line-default bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {entry ?? 'All'}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search className="size-5" />}
                title="No templates match"
                description="Try another search or group."
              />
            </Card>
          ) : (
            orderGroups(visible.map((template) => template.group)).map((name) => {
              const inGroup = visible.filter((template) => template.group === name)
              return (
                <section key={name} aria-labelledby={`group-${name}`}>
                  <h2 id={`group-${name}`} className="text-ink-muted mb-2 px-1 text-[13px] font-semibold">
                    {name} <span className="text-ink-subtle font-normal">· {inGroup.length}</span>
                  </h2>
                  <Card className="overflow-hidden">
                    <ul className="divide-line divide-y">
                      {inGroup.map((template) => (
                        <TemplateRow key={template.id} template={template} onAssign={() => setAssigning(template)} />
                      ))}
                    </ul>
                  </Card>
                </section>
              )
            })
          )}
        </>
      )}

      {assigning ? <AssignTemplateModal template={assigning} onClose={() => setAssigning(null)} /> : null}
    </div>
  )
}

function TemplateRow({ template, onAssign }: { template: TaskTemplate; onAssign: () => void }) {
  const questions = questionCount(template)
  return (
    <li className="hover:bg-surface-muted/60 flex items-center gap-2 pr-2 transition-colors sm:pr-3">
      <Link to={`/templates/${template.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 sm:pl-5">
        <span className="bg-surface-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-lg" aria-hidden>
          {template.icon || <LayoutTemplate className="text-ink-subtle size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-medium', template.name ? 'text-ink' : 'text-ink-subtle italic')}>
            {template.name || 'Untitled template'}
          </span>
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
        <ChevronRight className="text-ink-subtle size-4 shrink-0 sm:hidden" />
      </Link>
      <Button size="sm" onClick={onAssign} disabled={template.tasks.length === 0} className="hidden sm:inline-flex">
        <UserPlus className="size-4" />
        Assign
      </Button>
      <IconButton label={`Assign ${template.name || 'template'}`} size="sm" onClick={onAssign} disabled={template.tasks.length === 0} className="sm:hidden">
        <UserPlus className="size-4" />
      </IconButton>
      <ChevronRight className="text-ink-subtle hidden size-4 shrink-0 sm:block" aria-hidden />
    </li>
  )
}
