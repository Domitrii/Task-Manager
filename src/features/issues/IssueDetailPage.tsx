import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Check, CircleAlert, Clock, History, Loader, Pencil } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { FoodSafetyIssue } from '@/data/types'
import { useGoBack } from '@/lib/useGoBack'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { InfoCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { useIsManager } from '@/features/temperatures/access'
import { EditResolutionModal, ResolveIssueModal } from './IssueModals'
import { IssueBadge, PRIORITY_LABELS, SOURCE_LABELS } from './IssuesPage'

const STEPS = ['Open', 'In progress', 'Resolved'] as const

function Steps({ issue }: { issue: FoodSafetyIssue }) {
  const reached = issue.status === 'resolved' ? 3 : issue.status === 'in_progress' ? 1 : 0
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
      {STEPS.map((step, index) => {
        const done = index < reached || index === 0
        const current = index === reached && !done
        const Icon = done ? Check : current ? Loader : Clock
        return (
          <li
            key={step}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 rounded-[10px] px-1 py-2.5 text-center text-xs font-medium',
              done
                ? 'bg-pass-50 text-pass-700 dark:bg-pass-500/12 dark:text-pass-500'
                : current
                  ? 'bg-surface-muted text-ink'
                  : 'bg-surface text-ink-muted',
            )}
          >
            <Icon className="size-4" />
            {step}
          </li>
        )
      })}
    </ol>
  )
}

export function IssueDetailPage() {
  const { id } = useParams()
  const { data, activeStaff, updateIssue } = useStore()
  const manager = useIsManager()
  const goBack = useGoBack('/food-safety')
  const [resolving, setResolving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [signed, setSigned] = useState(false)
  const issue = data.issues.find((entry) => entry.id === id)

  if (!issue) return <Navigate to="/food-safety" replace />

  const canEdit = manager || issue.resolvedBy === activeStaff.id
  const signOff = () => {
    updateIssue(issue.id, { needsSignOff: false, signedOffBy: activeStaff.id, signedOffAt: new Date().toISOString() })
    setSigned(true)
  }

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Issue detail" onBack={goBack} />

      <section className="bg-surface shadow-card rounded-card p-4">
        <h2 className="font-display text-ink text-lg leading-snug font-bold">{issue.title}</h2>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-ink-muted text-[13px]">{SOURCE_LABELS[issue.source]}</span>
          <Badge
            tone={issue.severity === 'high' ? 'fail' : 'neutral'}
            icon={issue.severity === 'high' ? <CircleAlert className="size-3.5" /> : undefined}
          >
            {PRIORITY_LABELS[issue.severity]}
          </Badge>
        </div>
        <div className="mt-2">
          <IssueBadge issue={issue} />
        </div>
        <p className="text-ink-muted mt-2 text-[13px]">
          Reported by {staffName(data, issue.raisedBy)} · {format(parseISO(issue.raisedAt), 'd MMM HH:mm')}
        </p>
        {issue.assigneeId ? (
          <p className="text-ink-muted text-[13px]">Assigned to {staffName(data, issue.assigneeId)}</p>
        ) : null}
      </section>

      <Steps issue={issue} />

      <InfoCard title="Description">
        <p className="whitespace-pre-line">{issue.description}</p>
      </InfoCard>

      {issue.resolution ? (
        <InfoCard
          title="What was done"
          action={
            canEdit ? (
              <Button size="sm" aria-label="Edit what was done" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            ) : null
          }
        >
          <p className="whitespace-pre-line">{issue.resolution}</p>
          {issue.resolvedAt ? (
            <p className="text-ink-subtle text-xs">
              Resolved {format(parseISO(issue.resolvedAt), 'd MMM HH:mm')}
              {issue.resolvedBy ? ` by ${staffName(data, issue.resolvedBy)}` : ''}
            </p>
          ) : null}
          {canEdit ? null : (
            <p className="text-ink-subtle text-xs">
              Only {issue.resolvedBy ? `${staffName(data, issue.resolvedBy)} or a manager` : 'a manager'} can change this.
            </p>
          )}
          <ResolutionHistory issue={issue} />
        </InfoCard>
      ) : null}

      {signed && issue.signedOffAt ? <Banner tone="pass" title="Issue signed off" /> : null}
      {issue.signedOffBy && issue.signedOffAt ? (
        <p className="text-ink-muted text-[13px]">
          Signed off by {staffName(data, issue.signedOffBy)} · {format(parseISO(issue.signedOffAt), 'd MMM HH:mm')}
        </p>
      ) : null}

      {issue.status === 'open' ? (
        <PinnedAction>
          <Button block size="lg" variant="primary" onClick={() => updateIssue(issue.id, { status: 'in_progress' })}>
            Mark as in progress
          </Button>
        </PinnedAction>
      ) : issue.status === 'in_progress' ? (
        <PinnedAction>
          <Button block size="lg" variant="primary" onClick={() => setResolving(true)}>
            Mark as resolved
          </Button>
        </PinnedAction>
      ) : issue.needsSignOff ? (
        <PinnedAction>
          {manager ? (
            <Button block size="lg" variant="primary" onClick={signOff}>
              Sign off
            </Button>
          ) : (
            <p className="text-ink-muted text-[13px]">Resolved. Waiting for a manager to sign this off.</p>
          )}
        </PinnedAction>
      ) : null}

      {resolving ? <ResolveIssueModal issue={issue} onClose={() => setResolving(false)} /> : null}
      {editing ? <EditResolutionModal issue={issue} onClose={() => setEditing(false)} /> : null}
    </div>
  )
}

/** Each change to what was done, newest first, with what it said before. */
function ResolutionHistory({ issue }: { issue: FoodSafetyIssue }) {
  const { data } = useStore()
  const edits = issue.resolutionEdits ?? []
  if (edits.length === 0) return null

  return (
    <div className="pt-3">
      <h3 className="text-ink flex items-center gap-1.5 text-[13px] font-semibold">
        <History className="size-3.5" />
        Changes
      </h3>
      <ol className="border-line divide-line mt-2 divide-y rounded-lg border">
        {edits
          .map((edit, index) => ({ edit, index }))
          .reverse()
          .map(({ edit, index }) => (
            <li key={index} className="px-3 py-2.5">
              <p className="text-ink-subtle text-xs">
                {format(parseISO(edit.at), 'd MMM HH:mm')} · {staffName(data, edit.by)}
              </p>
              <p className="text-ink mt-0.5 whitespace-pre-line">Before: {edit.before}</p>
            </li>
          ))}
      </ol>
    </div>
  )
}
