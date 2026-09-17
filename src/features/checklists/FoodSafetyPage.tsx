import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react'
import { selectChecklistStatus, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { FoodSafetyIssue, IssueSeverity, IssueStatus } from '@/data/types'
import { formatRelativeDay } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn, titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { IssueStatusBadge, SeverityBadge } from '@/components/shared/StatusBadge'
import { ChecklistSection } from './ChecklistSection'

type TabKey = 'open' | 'all' | 'checks'

export function FoodSafetyPage() {
  const now = useNow()
  const { data, updateIssue } = useStore()
  const [tab, setTab] = useState<TabKey>('open')
  const [raising, setRaising] = useState(false)
  const [resolving, setResolving] = useState<FoodSafetyIssue | undefined>(undefined)

  const open = useMemo(() => data.issues.filter((issue) => issue.status !== 'resolved'), [data.issues])
  const high = open.filter((issue) => issue.severity === 'high')
  const checks = useMemo(() => selectChecklistStatus(data, now, ['food_safety']), [data, now])
  const resolvedThisMonth = data.issues.filter(
    (issue) => issue.status === 'resolved' && new Date(issue.raisedAt).getMonth() === now.getMonth(),
  ).length

  const visible = tab === 'open' ? open : data.issues

  if (tab === 'checks') {
    return (
      <div className="space-y-5">
        <FoodSafetyTabs tab={tab} onChange={setTab} openCount={open.length} total={data.issues.length} checks={checks.length} />
        <ChecklistSection
          title="Daily food safety checks"
          description="The review a manager signs off each day: separation, dates, allergens and cooling records."
          types={['food_safety']}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Food safety"
        description="Issues raised automatically from failed checks and rejected deliveries, plus anything reported by the team."
        actions={
          <Button variant="primary" onClick={() => setRaising(true)} className="gap-1.5">
            <Plus className="size-4" />
            Raise an issue
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Open issues"
          value={open.length}
          sublabel={`${open.filter((issue) => issue.status === 'in_progress').length} being worked on`}
          icon={<ShieldAlert className="size-4" />}
          tone={open.length > 0 ? 'fail' : 'pass'}
        />
        <StatCard
          label="High severity"
          value={high.length}
          sublabel={high.length > 0 ? 'Needs attention today' : 'Nothing urgent'}
          icon={<AlertTriangle className="size-4" />}
          tone={high.length > 0 ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Resolved this month"
          value={resolvedThisMonth}
          sublabel="Closed with a recorded resolution"
          icon={<ShieldCheck className="size-4" />}
          tone="pass"
        />
        <StatCard
          label="Daily checks today"
          value={`${checks.filter((entry) => entry.run).length}/${checks.length}`}
          sublabel="Food safety review sign-off"
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-1 sm:px-5">
          <FoodSafetyTabs
            tab={tab}
            onChange={setTab}
            openCount={open.length}
            total={data.issues.length}
            checks={checks.length}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-5" />}
            title="No issues to show"
            description="Failed temperature checks, rejected deliveries and failed critical checklist items appear here automatically."
          />
        ) : (
          <ul className="divide-line divide-y">
            {visible.map((issue) => (
              <li key={issue.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ink text-sm font-semibold">{issue.title}</p>
                      <SeverityBadge severity={issue.severity} />
                      <IssueStatusBadge status={issue.status} />
                      <Badge tone="neutral">{titleCase(issue.source)}</Badge>
                    </div>
                    <p className="text-ink-muted mt-1.5 text-[13px] whitespace-pre-line">
                      {issue.description}
                    </p>
                    <div className="text-ink-subtle mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <Avatar
                          person={data.staff.find((person) => person.id === issue.raisedBy)}
                          size="xs"
                        />
                        Raised by {staffName(data, issue.raisedBy)} · {formatRelativeDay(issue.raisedAt)}
                      </span>
                      {issue.assigneeId ? <span>Assigned to {staffName(data, issue.assigneeId)}</span> : null}
                    </div>
                    {issue.resolution ? (
                      <p className="border-pass-500/30 bg-pass-50 dark:bg-pass-500/8 text-ink-muted mt-2.5 rounded-lg border px-3 py-2 text-[13px]">
                        <span className="text-pass-700 dark:text-pass-500 font-medium">Resolved:</span>{' '}
                        {issue.resolution}
                      </p>
                    ) : null}
                  </div>

                  {issue.status !== 'resolved' ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {issue.status === 'open' ? (
                        <Button
                          size="sm"
                          onClick={() => updateIssue(issue.id, { status: 'in_progress' })}
                        >
                          Start
                        </Button>
                      ) : null}
                      <Button size="sm" variant="primary" onClick={() => setResolving(issue)}>
                        Resolve
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RaiseIssueModal open={raising} onClose={() => setRaising(false)} />
      <ResolveIssueModal issue={resolving} onClose={() => setResolving(undefined)} />
    </div>
  )
}

function FoodSafetyTabs({
  tab,
  onChange,
  openCount,
  total,
  checks,
}: {
  tab: TabKey
  onChange: (value: TabKey) => void
  openCount: number
  total: number
  checks: number
}) {
  return (
    <Tabs
      value={tab}
      onChange={onChange}
      options={[
        { value: 'open', label: 'Open issues', count: openCount },
        { value: 'all', label: 'All issues', count: total },
        { value: 'checks', label: 'Daily checks', count: checks },
      ]}
    />
  )
}

function RaiseIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    toast.success('Issue raised', 'It now appears on the dashboard until it is resolved.')
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
      title="Raise a food safety issue"
      description="Anything the team spots that needs following up."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
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

function ResolveIssueModal({
  issue,
  onClose,
}: {
  issue: FoodSafetyIssue | undefined
  onClose: () => void
}) {
  const { updateIssue } = useStore()
  const toast = useToast()
  const [resolution, setResolution] = useState('')

  if (!issue) return null

  function handleResolve() {
    if (!issue || !resolution.trim()) return
    const changes: Partial<FoodSafetyIssue> = {
      status: 'resolved' as IssueStatus,
      resolution: resolution.trim(),
      resolvedAt: new Date().toISOString(),
    }
    updateIssue(issue.id, changes)
    toast.success('Issue resolved', 'The resolution has been saved to the record.')
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
          <Button variant="ghost" onClick={onClose}>
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
          hint="This becomes part of the permanent record for this issue."
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
