import { useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, ClipboardCheck, ClipboardList, Clock } from 'lucide-react'
import { selectChecklistStatus, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ChecklistRun, ChecklistTemplate, ChecklistType } from '@/data/types'
import { formatDate, formatRelativeDay, formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn, percent } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { ProgressBar } from '@/components/shared/ProgressRing'
import { StatCard } from '@/components/shared/StatCard'
import { ChecklistRunModal } from './ChecklistRunModal'

/** Shared page for any group of checklists — cleaning, opening/closing, safety. */
export function ChecklistSection({
  title,
  description,
  types,
  filters,
}: {
  title: string
  description: string
  types: ChecklistType[]
  /** Chips for switching between checklist types, shown under the title. */
  filters?: ReactNode
}) {
  const now = useNow()
  const { data } = useStore()
  const [running, setRunning] = useState<ChecklistTemplate | undefined>(undefined)
  const [viewing, setViewing] = useState<{ template: ChecklistTemplate; run: ChecklistRun } | undefined>(
    undefined,
  )

  const statuses = useMemo(() => selectChecklistStatus(data, now, types), [data, now, types])
  const templateIds = useMemo(() => new Set(statuses.map((entry) => entry.template.id)), [statuses])

  const history = useMemo(
    () => data.checklistRuns.filter((run) => templateIds.has(run.templateId)).slice(0, 30),
    [data.checklistRuns, templateIds],
  )

  const completed = statuses.filter((entry) => entry.state === 'complete' || entry.state === 'issues').length
  const overdue = statuses.filter((entry) => entry.state === 'overdue').length
  const failedItems = statuses.reduce((total, entry) => total + entry.failedCount, 0)

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description}>
        {filters}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Completed today"
          value={`${completed}/${statuses.length}`}
          sublabel={`${percent(completed, statuses.length)}% of today's checklists`}
          icon={<CheckCircle2 className="size-4" />}
          tone={completed === statuses.length ? 'pass' : 'neutral'}
        />
        <StatCard
          label="Overdue"
          value={overdue}
          sublabel={overdue > 0 ? 'Window has closed' : 'Nothing missed'}
          icon={<Clock className="size-4" />}
          tone={overdue > 0 ? 'fail' : 'neutral'}
        />
        <StatCard
          label="Failed items today"
          value={failedItems}
          sublabel={failedItems > 0 ? 'Each one has a note on file' : 'No failures recorded'}
          icon={<ClipboardList className="size-4" />}
          tone={failedItems > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="Records kept"
          value={data.checklistRuns.filter((run) => templateIds.has(run.templateId)).length}
          sublabel="Signed-off checklist runs"
          icon={<ClipboardCheck className="size-4" />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statuses.map((entry) => {
          const total = entry.template.items.length
          const passed = entry.run
            ? entry.run.results.filter((result) => result.status !== 'fail').length
            : 0
          return (
            <div
              key={entry.template.id}
              className={cn(
                'bg-surface rounded-card flex flex-col border p-4 shadow-card',
                entry.state === 'overdue' ? 'border-fail-500/40' : 'border-line',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold">{entry.template.name}</p>
                  <p className="text-ink-muted text-xs">
                    {entry.template.area ? `${entry.template.area} · ` : ''}
                    {total} checks
                  </p>
                </div>
                {entry.state === 'complete' ? (
                  <Badge tone="pass">Complete</Badge>
                ) : entry.state === 'issues' ? (
                  <Badge tone="warn">
                    {entry.failedCount} issue{entry.failedCount === 1 ? '' : 's'}
                  </Badge>
                ) : entry.state === 'overdue' ? (
                  <Badge tone="fail">Overdue</Badge>
                ) : entry.state === 'due' ? (
                  <Badge tone="warn">Due now</Badge>
                ) : (
                  <Badge tone="neutral">Later today</Badge>
                )}
              </div>

              <div className="mt-4">
                <ProgressBar
                  value={entry.run ? (passed / total) * 100 : 0}
                  tone={entry.failedCount > 0 ? 'warn' : entry.run ? 'pass' : 'brand'}
                />
                <p className="text-ink-muted mt-2 text-xs">
                  {entry.run
                    ? `Signed off at ${formatTime(entry.run.completedAt)} by ${staffName(data, entry.run.completedBy)}`
                    : 'Not started today'}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                {entry.run ? (
                  <Button
                    size="sm"
                    block
                    onClick={() => setViewing({ template: entry.template, run: entry.run as ChecklistRun })}
                  >
                    View record
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" block onClick={() => setRunning(entry.template)}>
                    Start checklist
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Recent records" description="Signed-off checklists kept for inspection" />
        {history.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="size-5" />} title="No records yet" />
        ) : (
          <ul className="divide-line divide-y">
            {history.map((run) => {
              const template = data.checklistTemplates.find((entry) => entry.id === run.templateId)
              if (!template) return null
              const failed = run.results.filter((result) => result.status === 'fail').length
              const person = data.staff.find((entry) => entry.id === run.completedBy)
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setViewing({ template, run })}
                    className="hover:bg-surface-muted/60 flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5"
                  >
                    <Avatar person={person} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-[13px] font-medium">{template.name}</p>
                      <p className="text-ink-muted truncate text-xs">
                        {formatDate(run.date)} · {formatRelativeDay(run.completedAt)} ·{' '}
                        {staffName(data, run.completedBy)}
                      </p>
                    </div>
                    {failed > 0 ? (
                      <Badge tone="warn">
                        {failed} failed
                      </Badge>
                    ) : (
                      <Badge tone="pass">All passed</Badge>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="text-ink-subtle text-xs">
        Checklists reset at midnight. Today is {format(now, 'EEEE d MMMM yyyy')}.
      </p>

      {running ? <ChecklistRunModal template={running} onClose={() => setRunning(undefined)} /> : null}
      {viewing ? (
        <ChecklistRunModal
          template={viewing.template}
          existing={viewing.run}
          onClose={() => setViewing(undefined)}
        />
      ) : null}
    </div>
  )
}
