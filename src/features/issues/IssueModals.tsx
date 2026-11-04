import { useState } from 'react'
import { useStore } from '@/data/store'
import type { FoodSafetyIssue, IssueSeverity, IssueStatus } from '@/data/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export function RaiseIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, activeStaffId, addIssue } = useStore()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<IssueSeverity>('medium')
  const [assigneeId, setAssigneeId] = useState('')

  function handleSave() {
    if (!title.trim()) return
    addIssue({
      title: title.trim(),
      description: description.trim() || 'No further detail recorded.',
      severity,
      status: 'open',
      source: 'manual',
      raisedAt: new Date().toISOString(),
      raisedBy: activeStaffId,
      assigneeId: assigneeId || undefined,
    })
    toast.success('Issue raised', 'It stays on the Issues page until it is resolved.')
    setTitle('')
    setDescription('')
    setSeverity('medium')
    setAssigneeId('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report issue"
      description="Anything the team spots that needs following up."
      footer={
        <>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!title.trim()}>
            Raise issue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What is the issue?" required htmlFor="issue-title">
          <TextInput
            id="issue-title"
            value={title}
            autoFocus
            placeholder="e.g. Hand wash sink not draining in the larder"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Detail" htmlFor="issue-description">
          <Textarea
            id="issue-description"
            value={description}
            placeholder="What happened, what was affected, and anything done so far."
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Severity" htmlFor="issue-severity">
            <Select
              id="issue-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as IssueSeverity)}
            >
              <option value="low">Low — monitor</option>
              <option value="medium">Medium — fix soon</option>
              <option value="high">High — act today</option>
            </Select>
          </Field>
          <Field label="Assign to" hint="Optional" htmlFor="issue-assignee">
            <Select
              id="issue-assignee"
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
        </div>
      </div>
    </Modal>
  )
}

export function ResolveIssueModal({
  issue,
  onClose,
}: {
  issue: FoodSafetyIssue | undefined
  onClose: () => void
}) {
  const { activeStaffId, updateIssue } = useStore()
  const toast = useToast()
  const [resolution, setResolution] = useState('')

  if (!issue) return null

  function handleResolve() {
    if (!issue || !resolution.trim()) return
    const changes: Partial<FoodSafetyIssue> = {
      status: 'resolved' as IssueStatus,
      resolution: resolution.trim(),
      resolvedAt: new Date().toISOString(),
      resolvedBy: activeStaffId,
      needsSignOff: true,
    }
    updateIssue(issue.id, changes)
    toast.success('Issue resolved', 'A manager can now sign it off.')
    setResolution('')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolve issue"
      description={issue.title}
      footer={
        <>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleResolve} disabled={!resolution.trim()}>
            Mark resolved
          </Button>
        </>
      }
    >
      <div className={cn('space-y-4')}>
        <Field
          label="What was done?"
          required
          hint="You can change this later. What it said first stays on the record."
          htmlFor="issue-resolution"
        >
          <Textarea
            id="issue-resolution"
            value={resolution}
            autoFocus
            placeholder="e.g. Engineer replaced the door seal, unit held 3°C over 24 hours of monitoring."
            onChange={(event) => setResolution(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

/** Changing what a resolved issue says was done. What it said before stays with the issue. */
export function EditResolutionModal({ issue, onClose }: { issue: FoodSafetyIssue; onClose: () => void }) {
  const { editIssueResolution } = useStore()
  const toast = useToast()
  const [resolution, setResolution] = useState(issue.resolution ?? '')
  const text = resolution.trim()
  const canSave = text !== '' && text !== issue.resolution

  function handleSave() {
    if (!canSave) return
    editIssueResolution(issue.id, text)
    toast.success('Answer changed', 'A manager can now sign it off.')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit what was done"
      description={issue.title}
      footer={
        <>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            Save changes
          </Button>
        </>
      }
    >
      <Field
        label="What was done?"
        required
        hint={
          issue.status === 'resolved' && !issue.needsSignOff
            ? 'What it said before is kept. Saving reopens this issue until a manager signs off the change.'
            : 'What it said before is kept, and a manager signs off the new wording.'
        }
        htmlFor="issue-edit-resolution"
      >
        <Textarea
          id="issue-edit-resolution"
          value={resolution}
          autoFocus
          onChange={(event) => setResolution(event.target.value)}
        />
      </Field>
    </Modal>
  )
}
