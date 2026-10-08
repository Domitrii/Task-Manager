import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, LayoutTemplate, LibraryBig, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/data/store'
import { newTemplateTask } from '@/data/taskQuestions'
import type { TaskTemplate } from '@/data/types'
import { cn, createId } from '@/lib/utils'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { templatePath } from './editing'

/** Settings → Templates: the venue's saved templates, to edit or remove. */
export function ManageTemplates() {
  const { data, saveTaskTemplate, deleteTaskTemplate } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [deleting, setDeleting] = useState<TaskTemplate | null>(null)

  function create() {
    const template: TaskTemplate = { id: createId('tp'), name: '', group: 'Ad hoc', tags: [], tasks: [newTemplateTask()] }
    saveTaskTemplate(template)
    navigate(templatePath(template.id))
  }

  function confirmDelete() {
    if (!deleting) return
    deleteTaskTemplate(deleting.id)
    toast.success('Template removed', 'Tasks already created from it keep their questions.')
    setDeleting(null)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Manage templates"
        description="Templates saved for this venue. Pick one under “Template to use” when creating a task."
        action={
          <>
            <ButtonLink to="/templates" size="sm">
              <LibraryBig className="size-4" />
              Browse library
            </ButtonLink>
            <Button variant="primary" size="sm" onClick={create}>
              <Plus className="size-4" />
              New template
            </Button>
          </>
        }
      />

      {data.taskTemplates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="size-5" />}
          title="No saved templates"
          description="Add some from the library, or start one from scratch."
          action={<ButtonLink to="/templates">Browse the library</ButtonLink>}
        />
      ) : (
        <ul className="divide-line divide-y">
          {data.taskTemplates.map((template) => {
            const questions = template.tasks.reduce((total, task) => total + task.questions.length, 0)
            return (
              <li key={template.id} className="hover:bg-surface-muted/60 flex items-center gap-1 pr-2 transition-colors sm:pr-3">
                <Link to={templatePath(template.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 sm:pl-5">
                  <span className="bg-surface-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-lg" aria-hidden>
                    {template.icon || <LayoutTemplate className="text-ink-subtle size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium', template.name ? 'text-ink' : 'text-ink-subtle italic')}>
                      {template.name || 'Untitled template'}
                    </span>
                    <span className="text-ink-muted mt-0.5 block truncate text-xs">
                      {template.group} · {template.tasks.length} task{template.tasks.length === 1 ? '' : 's'} · {questions}{' '}
                      question{questions === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
                <IconButton label={`Edit ${template.name || 'template'}`} size="sm" onClick={() => navigate(templatePath(template.id))}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label={`Delete ${template.name || 'template'}`} size="sm" onClick={() => setDeleting(template)}>
                  <Trash2 className="size-4" />
                </IconButton>
                <ChevronRight className="text-ink-subtle hidden size-4 shrink-0 sm:block" aria-hidden />
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this template?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete template
            </Button>
          </>
        }
      >
        <p className="text-ink-muted text-sm">
          {deleting?.name || 'This template'} will no longer be offered when creating a task. Tasks already created from
          it keep their questions.
          {deleting?.id.startsWith('lib-') ? ' You can add it again from the library, without your changes.' : ''}
        </p>
      </Modal>
    </Card>
  )
}
