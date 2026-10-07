import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { TaskTemplate } from '@/data/types'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** Adds some or all of a template's tasks to one person's list, each with its own copy of the questions. */
export function AssignTemplateModal({ template, onClose }: { template: TaskTemplate; onClose: () => void }) {
  const { data, activeStaffId, addTasks } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [assigneeId, setAssigneeId] = useState(activeStaffId)
  const [dueAt, setDueAt] = useState('')
  const [picked, setPicked] = useState(() => new Set(template.tasks.map((task) => task.id)))

  const chosen = template.tasks.filter((task) => picked.has(task.id))
  const allPicked = chosen.length === template.tasks.length

  function toggle(id: string, on: boolean) {
    const next = new Set(picked)
    if (on) next.add(id)
    else next.delete(id)
    setPicked(next)
  }

  function handleAdd() {
    if (chosen.length === 0) return
    addTasks(
      chosen.map((task) => ({
        title: task.title.trim() || 'Untitled task',
        description: task.description?.trim() || undefined,
        assigneeId: assigneeId || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        priority: task.priority,
        status: 'todo',
        category: task.category,
        questions: structuredClone(task.questions),
        templateId: template.id,
      })),
    )
    const who = assigneeId ? `${staffName(data, assigneeId)}’s list` : 'the team’s list, unassigned'
    toast.success(`${chosen.length} task${chosen.length === 1 ? '' : 's'} added`, `From ${template.name}, on ${who}.`)
    onClose()
    navigate('/tasks')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add to someone’s tasks"
      description={`${template.icon ? `${template.icon} ` : ''}${template.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAdd} disabled={chosen.length === 0}>
            Add {chosen.length} task{chosen.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to" htmlFor="assign-person">
            <Select id="assign-person" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
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
          <Field label="Due" hint="Optional" htmlFor="assign-due">
            <TextInput
              id="assign-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-ink text-[13px] font-medium">Tasks to add</p>
            {template.tasks.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPicked(allPicked ? new Set() : new Set(template.tasks.map((task) => task.id)))}
              >
                {allPicked ? 'Select none' : 'Select all'}
              </Button>
            ) : null}
          </div>
          {template.tasks.length === 0 ? (
            <p className="text-ink-muted text-sm">This template has no tasks yet. Add some first.</p>
          ) : (
            <ul className="border-line divide-line divide-y rounded-lg border">
              {template.tasks.map((task) => (
                <li key={task.id} className="px-3 py-2.5">
                  <Checkbox
                    label={task.title || 'Untitled task'}
                    description={`${task.questions.length} question${task.questions.length === 1 ? '' : 's'}`}
                    checked={picked.has(task.id)}
                    onChange={(event) => toggle(task.id, event.target.checked)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
