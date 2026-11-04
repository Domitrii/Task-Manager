import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, CircleAlert, ClipboardList, Info, TriangleAlert } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { FoodSafetyIssue, IssueSeverity, IssueSource } from '@/data/types'
import { useGoBack } from '@/lib/useGoBack'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChipTabs } from '@/components/ui/Tabs'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { RaiseIssueModal } from './IssueModals'

export const SOURCE_LABELS: Record<IssueSource, string> = {
  temperature: 'Temperature',
  delivery: 'Delivery',
  checklist: 'Checklist',
  manual: 'Reported',
}

export const PRIORITY_LABELS: Record<IssueSeverity, string> = {
  high: 'High priority',
  medium: 'Normal priority',
  low: 'Low priority',
}

export const isClosed = (issue: FoodSafetyIssue) => issue.status === 'resolved' && !issue.needsSignOff

export function IssueBadge({ issue }: { issue: FoodSafetyIssue }) {
  if (issue.needsSignOff) {
    return (
      <Badge tone="warn" icon={<TriangleAlert className="size-3.5" />}>
        Needs sign-off
      </Badge>
    )
  }
  if (issue.status === 'resolved') {
    return (
      <Badge tone="pass" icon={<Check className="size-3.5" />}>
        {issue.signedOffAt ? 'Signed off' : 'Resolved'}
      </Badge>
    )
  }
  return issue.status === 'in_progress' ? (
    <Badge icon={<Info className="size-3.5" />}>In progress</Badge>
  ) : (
    <Badge tone="fail" icon={<CircleAlert className="size-3.5" />}>
      Open
    </Badge>
  )
}

export function IssuesPage() {
  const { data } = useStore()
  const goBack = useGoBack('/more')
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const [reporting, setReporting] = useState(false)

  const open = useMemo(() => data.issues.filter((issue) => !isClosed(issue)), [data.issues])
  const closed = useMemo(() => data.issues.filter(isClosed), [data.issues])
  const signOff = open.filter((issue) => issue.needsSignOff).length
  const shown = tab === 'open' ? open : closed

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Issues" onBack={goBack} />

      <ChipTabs
        stretch
        label="Issues"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title={tab === 'open' ? 'No open issues' : 'No closed issues'}
          description={
            tab === 'open'
              ? 'Nothing needs follow-up here. Report an issue when the team needs to act.'
              : 'Issues appear here once they’re resolved and signed off.'
          }
        />
      ) : (
        <>
          {tab === 'open' ? (
            <p className="text-ink-muted text-[13px]">
              {open.length} open {open.length === 1 ? 'issue' : 'issues'}
              {signOff > 0 ? ` · ${signOff} needs manager sign-off` : ''}
            </p>
          ) : null}
          <ul className="space-y-2.5">
            {shown.map((issue) => (
              <li key={issue.id}>
                <ListCard
                  to={`/food-safety/${issue.id}`}
                  icon={Info}
                  title={issue.title}
                  subtitle={`${format(parseISO(issue.raisedAt), 'd MMM HH:mm')} · ${staffName(data, issue.raisedBy)}`}
                >
                  <IssueBadge issue={issue} />
                  <span className="text-ink-muted mt-1 block text-xs">
                    {[
                      SOURCE_LABELS[issue.source],
                      PRIORITY_LABELS[issue.severity],
                      issue.signedOffBy
                        ? `Signed off by ${staffName(data, issue.signedOffBy)}`
                        : issue.assigneeId
                          ? `Assigned to ${staffName(data, issue.assigneeId)}`
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </ListCard>
              </li>
            ))}
          </ul>
        </>
      )}

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setReporting(true)}>
          Report issue
        </Button>
      </PinnedAction>
      <RaiseIssueModal open={reporting} onClose={() => setReporting(false)} />
    </div>
  )
}
