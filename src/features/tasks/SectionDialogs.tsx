import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useStore } from '@/data/store'
import type { ID, TaskSection } from '@/data/types'
import { createId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/** Naming a new group of tasks, or an existing one. */
export function GroupSheet({
  section,
  onClose,
  onCreated,
}: {
  section?: TaskSection
  onClose: () => void
  onCreated?: (id: ID) => void
}) {
  const { data, saveTaskSection } = useStore()
  const toast = useToast()
  const [name, setName] = useState(section?.name ?? '')
  const [submitted, setSubmitted] = useState(false)
  const missing = submitted && name.trim() === ''

  function save() {
    setSubmitted(true)
    if (name.trim() === '') return
    if (section) {
      saveTaskSection({ ...section, name: name.trim() })
      toast.success('Section renamed')
    } else {
      const id = createId('sc')
      const position = Math.max(-1, ...data.taskSections.map((entry) => entry.position)) + 1
      saveTaskSection({ id, name: name.trim(), position })
      toast.success('Group created')
      onCreated?.(id)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={section ? 'Rename section' : 'Create group'}
      description={section ? undefined : 'Keep related tasks together in a named section.'}
      size="sm"
      footer={
        <>
          <Button variant="primary" onClick={save}>
            {section ? 'Save name' : 'Create group'}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        noValidate
      >
        <Field
          label="Group name"
          htmlFor="group-name"
          hint="Use a short name the team will recognise."
          error={missing ? 'Enter a group name.' : undefined}
        >
          <TextInput
            id="group-name"
            autoFocus
            value={name}
            invalid={missing}
            placeholder="e.g. Weekly deep clean"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}

export function DeleteSectionDialog({ section, onClose }: { section: TaskSection; onClose: () => void }) {
  const { data, deleteTaskSection } = useStore()
  const toast = useToast()
  const count = data.tasks.filter((task) => task.sectionId === section.id).length
  const tasks = count === 0 ? '' : ` and ${count === 1 ? 'its task' : `its ${count} tasks`}`

  return (
    <Modal
      open
      onClose={onClose}
      variant="alert"
      icon={<TriangleAlert className="size-5" />}
      title="Delete section?"
      description={`Deleting ${section.name} removes the section${tasks} for everyone at ${data.settings.venueName}. This can’t be undone.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteTaskSection(section.id)
              toast.success('Section deleted')
              onClose()
            }}
          >
            Delete section
          </Button>
        </>
      }
    />
  )
}
