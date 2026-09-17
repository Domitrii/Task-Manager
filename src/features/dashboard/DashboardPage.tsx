import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Package,
  ShieldAlert,
  Thermometer,
  TrendingUp,
} from 'lucide-react'
import { CATEGORY_ICONS } from '@/config/navigation'
import { selectComplianceTrend, selectDashboard, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatRange } from '@/lib/compliance'
import { formatRelativeDay, formatTemp, formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { useQuickEntry } from '@/components/layout/AppShell'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrendChart } from '@/components/shared/LazyCharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { StatCard } from '@/components/shared/StatCard'
import { DeliveryStatusBadge, SeverityBadge, SlotBadge } from '@/components/shared/StatusBadge'

export function DashboardPage() {
  const now = useNow()
  const { data, activeStaff } = useStore()
  const quickEntry = useQuickEntry()

  const summary = useMemo(() => selectDashboard(data, now), [data, now])
  const trend = useMemo(() => selectComplianceTrend(data, 14, now), [data, now])

  const actionable = useMemo(
    () =>
      summary.slots
        .filter((slot) => slot.state === 'overdue' || slot.state === 'due')
        .sort((a, b) => (a.state === b.state ? 0 : a.state === 'overdue' ? -1 : 1)),
    [summary.slots],
  )

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${activeStaff.name.split(' ')[0]}`}
        description={`${data.settings.venueName} · ${format(now, 'EEEE d MMMM yyyy')}`}
        actions={
          <>
            <Button onClick={() => quickEntry.recordDelivery()} className="gap-1.5">
              <Package className="size-4" />
              Log delivery
            </Button>
            <Button variant="primary" onClick={() => quickEntry.recordTemperature()} className="gap-1.5">
              <Thermometer className="size-4" />
              Record temperature
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Checks completed today"
          value={`${summary.checks.completed}/${summary.checks.required}`}
          sublabel={`${summary.adHocToday} additional ad-hoc probes`}
          icon={<CheckCircle2 className="size-4" />}
          tone={summary.checks.completed === summary.checks.required ? 'pass' : 'neutral'}
          to="/temperatures"
        />
        <StatCard
          label="Overdue checks"
          value={summary.checks.overdue}
          sublabel={
            summary.checks.due > 0 ? `${summary.checks.due} more due now` : 'Nothing else due right now'
          }
          icon={<Clock className="size-4" />}
          tone={summary.checks.overdue > 0 ? 'fail' : 'neutral'}
          to="/temperatures"
        />
        <StatCard
          label="Failed temperatures today"
          value={summary.failedLogsToday.length}
          sublabel={
            summary.failedLogsToday.length > 0 ? 'Corrective action recorded' : 'All readings in range'
          }
          icon={<AlertTriangle className="size-4" />}
          tone={summary.failedLogsToday.length > 0 ? 'fail' : 'neutral'}
          to="/food-safety"
        />
        <StatCard
          label="Deliveries today"
          value={summary.deliveriesToday.length}
          sublabel={`${summary.rejectedRecently.length} with rejections in the last 7 days`}
          icon={<Package className="size-4" />}
          to="/deliveries"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Checks needing attention"
              description={
                actionable.length === 0
                  ? 'Every scheduled check is up to date.'
                  : `${summary.checks.overdue} overdue · ${summary.checks.due} due now`
              }
              action={
                <ButtonLink to="/temperatures" size="sm" variant="ghost" className="gap-1">
                  View all
                  <ArrowRight className="size-3.5" />
                </ButtonLink>
              }
            />
            {actionable.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="size-5" />}
                title="Nothing outstanding"
                description="All scheduled temperature checks for the current windows have been recorded."
              />
            ) : (
              <ul className="divide-line divide-y">
                {actionable.slice(0, 6).map((slot) => {
                  const Icon = CATEGORY_ICONS[slot.item.category]
                  return (
                    <li
                      key={`${slot.item.id}-${slot.period}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          slot.state === 'overdue'
                            ? 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500'
                            : 'bg-warn-50 text-warn-600 dark:bg-warn-500/12 dark:text-warn-500',
                        )}
                      >
                        <Icon className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ink truncate text-sm font-medium">{slot.item.name}</p>
                        <p className="text-ink-muted truncate text-xs">
                          {slot.window.label} check · {slot.window.startTime}–{slot.window.endTime} ·{' '}
                          {formatRange(slot.item)}
                        </p>
                      </div>
                      <SlotBadge state={slot.state} />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => quickEntry.recordTemperature({ itemId: slot.item.id })}
                      >
                        Record
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent deliveries"
              description="Goods received and checked in over the last few days"
              action={
                <ButtonLink to="/deliveries" size="sm" variant="ghost" className="gap-1">
                  View all
                  <ArrowRight className="size-3.5" />
                </ButtonLink>
              }
            />
            {data.deliveries.length === 0 ? (
              <EmptyState
                icon={<Package className="size-5" />}
                title="No deliveries recorded"
                action={<Button variant="primary" size="sm" onClick={() => quickEntry.recordDelivery()}>Record a delivery</Button>}
              />
            ) : (
              <ul className="divide-line divide-y">
                {data.deliveries.slice(0, 5).map((delivery) => {
                  const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
                  const rejected = delivery.lines.filter((line) => !line.accepted).length
                  return (
                    <li key={delivery.id}>
                      <Link
                        to={`/deliveries?id=${delivery.id}`}
                        className="hover:bg-surface-muted/60 flex flex-wrap items-center gap-3 px-4 py-3 transition-colors sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-ink truncate text-sm font-medium">{supplier?.name}</p>
                          <p className="text-ink-muted truncate text-xs">
                            {formatRelativeDay(delivery.receivedAt)} · {delivery.lines.length} line
                            {delivery.lines.length === 1 ? '' : 's'}
                            {rejected > 0 ? ` · ${rejected} rejected` : ''} ·{' '}
                            {staffName(data, delivery.checkedBy)}
                          </p>
                        </div>
                        <DeliveryStatusBadge status={delivery.status} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Temperature checks — last 14 days"
              description="Every reading recorded, split by outcome"
              action={
                <ButtonLink to="/reports" size="sm" variant="ghost" className="gap-1">
                  Reports
                  <TrendingUp className="size-3.5" />
                </ButtonLink>
              }
            />
            <CardBody>
              <TrendChart data={trend} />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Today's compliance" description="Scheduled checks and daily checklists" />
            <CardBody className="flex flex-col items-center gap-4">
              <ProgressRing
                value={summary.overallCompliance}
                label={summary.overallCompliance === null ? 'nothing due yet' : 'complete'}
                sublabel={format(now, 'd MMM')}
              />
              <dl className="grid w-full grid-cols-2 gap-2.5">
                <Metric label="Completed" value={summary.checks.completed} tone="pass" />
                <Metric label="Failed" value={summary.checks.failed} tone="fail" />
                <Metric label="Due now" value={summary.checks.due} tone="warn" />
                <Metric label="Overdue" value={summary.checks.overdue} tone="fail" />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Food safety issues"
              description={`${summary.openIssues.length} open · ${summary.highSeverityIssues.length} high severity`}
              action={
                <ButtonLink to="/food-safety" size="sm" variant="ghost" className="gap-1">
                  Open
                  <ArrowRight className="size-3.5" />
                </ButtonLink>
              }
            />
            {summary.openIssues.length === 0 ? (
              <EmptyState
                icon={<ShieldAlert className="size-5" />}
                title="No open issues"
                description="Nothing is currently awaiting follow-up."
              />
            ) : (
              <ul className="divide-line divide-y">
                {summary.openIssues.slice(0, 4).map((issue) => (
                  <li key={issue.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ink text-sm leading-5 font-medium">{issue.title}</p>
                      <SeverityBadge severity={issue.severity} />
                    </div>
                    <p className="text-ink-muted mt-1 line-clamp-2 text-xs">{issue.description}</p>
                    <p className="text-ink-subtle mt-1.5 text-[11px]">
                      Raised {formatRelativeDay(issue.raisedAt)} by {staffName(data, issue.raisedBy)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Daily checklists"
              description="Opening, closing, cleaning and food safety"
              action={
                <ButtonLink to="/opening-closing" size="sm" variant="ghost" className="gap-1">
                  Open
                  <ArrowRight className="size-3.5" />
                </ButtonLink>
              }
            />
            <ul className="divide-line divide-y">
              {summary.checklists.map((entry) => (
                <li key={entry.template.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <ClipboardCheck className="text-ink-subtle size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-[13px] font-medium">{entry.template.name}</p>
                    {entry.run ? (
                      <p className="text-ink-muted truncate text-[11px]">
                        {formatTime(entry.run.completedAt)} · {staffName(data, entry.run.completedBy)}
                      </p>
                    ) : null}
                  </div>
                  {entry.state === 'complete' ? (
                    <Badge tone="pass">Done</Badge>
                  ) : entry.state === 'issues' ? (
                    <Badge tone="warn">{entry.failedCount} issue{entry.failedCount === 1 ? '' : 's'}</Badge>
                  ) : entry.state === 'overdue' ? (
                    <Badge tone="fail">Overdue</Badge>
                  ) : entry.state === 'due' ? (
                    <Badge tone="warn">Due</Badge>
                  ) : (
                    <Badge tone="neutral">Later</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Outstanding tasks"
              description={`${summary.outstandingTasks.length} open · ${summary.overdueTasks.length} past due`}
              action={
                <ButtonLink to="/tasks" size="sm" variant="ghost" className="gap-1">
                  Open
                  <ArrowRight className="size-3.5" />
                </ButtonLink>
              }
            />
            {summary.outstandingTasks.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nothing outstanding" />
            ) : (
              <ul className="divide-line divide-y">
                {summary.outstandingTasks.slice(0, 5).map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <Avatar person={data.staff.find((person) => person.id === task.assigneeId)} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-[13px] font-medium">{task.title}</p>
                      {task.dueAt ? (
                        <p
                          className={cn(
                            'truncate text-[11px]',
                            new Date(task.dueAt) < now ? 'text-fail-600 dark:text-fail-500' : 'text-ink-muted',
                          )}
                        >
                          Due {formatRelativeDay(task.dueAt)}
                        </p>
                      ) : null}
                    </div>
                    {task.priority === 'high' ? <Badge tone="fail">High</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {summary.failedLogsToday.length > 0 ? (
            <Card>
              <CardHeader title="Failed readings today" description="Each one needs a corrective action on file" />
              <ul className="divide-line divide-y">
                {summary.failedLogsToday.map((log) => {
                  const item = data.items.find((entry) => entry.id === log.itemId)
                  return (
                    <li key={log.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-ink truncate text-[13px] font-medium">{item?.name}</p>
                        <span className="tabular text-fail-600 dark:text-fail-500 text-sm font-semibold">
                          {formatTemp(log.temperature)}
                        </span>
                      </div>
                      <p className="text-ink-muted mt-0.5 text-[11px]">
                        {formatTime(log.recordedAt)} · {staffName(data, log.recordedBy)} · limit{' '}
                        {item ? formatRange(item) : '—'}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'pass' | 'fail' | 'warn'
}) {
  const colors = {
    pass: 'text-pass-600 dark:text-pass-500',
    fail: 'text-fail-600 dark:text-fail-500',
    warn: 'text-warn-600 dark:text-warn-500',
  }
  return (
    <div className="bg-surface-muted/70 rounded-lg px-3 py-2">
      <dt className="text-ink-muted text-[11px] font-medium">{label}</dt>
      <dd className={cn('tabular text-lg font-semibold', value > 0 ? colors[tone] : 'text-ink')}>{value}</dd>
    </div>
  )
}
