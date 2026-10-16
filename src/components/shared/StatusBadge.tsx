import { AlertTriangle, Ban, CalendarClock, CheckCircle2, CircleDashed, Clock, PencilLine, Truck, XCircle } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { CheckSlotState, OrderState } from '@/lib/compliance'
import type { CheckOutcome, DeliveryStatus, IssueSeverity, IssueStatus, TaskStatus } from '@/data/types'

const ICON = 'size-3.5'

export function OutcomeBadge({ outcome }: { outcome: CheckOutcome }) {
  return outcome === 'pass' ? (
    <Badge tone="pass" icon={<CheckCircle2 className={ICON} />}>
      In range
    </Badge>
  ) : (
    <Badge tone="fail" icon={<XCircle className={ICON} />}>
      Out of range
    </Badge>
  )
}

const SLOT_META: Record<CheckSlotState, { tone: BadgeTone; label: string; Icon: typeof CheckCircle2 }> = {
  done: { tone: 'pass', label: 'Complete', Icon: CheckCircle2 },
  failed: { tone: 'fail', label: 'Failed', Icon: XCircle },
  due: { tone: 'warn', label: 'Due now', Icon: Clock },
  overdue: { tone: 'fail', label: 'Overdue', Icon: AlertTriangle },
  upcoming: { tone: 'neutral', label: 'Upcoming', Icon: CircleDashed },
}

export function SlotBadge({ state }: { state: CheckSlotState }) {
  const { tone, label, Icon } = SLOT_META[state]
  return (
    <Badge tone={tone} icon={<Icon className={ICON} />}>
      {label}
    </Badge>
  )
}

const DELIVERY_META: Record<DeliveryStatus, { tone: BadgeTone; label: string; Icon: typeof CheckCircle2 }> = {
  accepted: { tone: 'pass', label: 'Accepted', Icon: CheckCircle2 },
  partially_rejected: { tone: 'warn', label: 'Part rejected', Icon: AlertTriangle },
  rejected: { tone: 'fail', label: 'Rejected', Icon: Ban },
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const { tone, label, Icon } = DELIVERY_META[status]
  return (
    <Badge tone={tone} icon={<Icon className={ICON} />}>
      {label}
    </Badge>
  )
}

const ORDER_META: Record<OrderState, { tone: BadgeTone; label: string; Icon: typeof CheckCircle2 }> = {
  draft: { tone: 'neutral', label: 'Draft', Icon: PencilLine },
  expected: { tone: 'info', label: 'Expected delivery', Icon: CalendarClock },
  due: { tone: 'brand', label: 'Due today', Icon: Truck },
  overdue: { tone: 'fail', label: 'Overdue', Icon: AlertTriangle },
  received: { tone: 'pass', label: 'Received', Icon: CheckCircle2 },
  cancelled: { tone: 'neutral', label: 'Cancelled', Icon: Ban },
}

export function OrderStatusBadge({ state }: { state: OrderState }) {
  const { tone, label, Icon } = ORDER_META[state]
  return (
    <Badge tone={tone} icon={<Icon className={ICON} />}>
      {label}
    </Badge>
  )
}

/** Something ordered didn't arrive, arrived short, or has a note on it. */
export function DiscrepancyBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <Badge tone="warn" icon={<AlertTriangle className={ICON} />}>
      Discrepancies{count > 1 ? ` (${count})` : ''}
    </Badge>
  )
}

const ISSUE_STATUS_META: Record<IssueStatus, { tone: BadgeTone; label: string }> = {
  open: { tone: 'fail', label: 'Open' },
  in_progress: { tone: 'warn', label: 'In progress' },
  resolved: { tone: 'pass', label: 'Resolved' },
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const { tone, label } = ISSUE_STATUS_META[status]
  return <Badge tone={tone}>{label}</Badge>
}

const SEVERITY_META: Record<IssueSeverity, { tone: BadgeTone; label: string }> = {
  low: { tone: 'neutral', label: 'Low' },
  medium: { tone: 'warn', label: 'Medium' },
  high: { tone: 'fail', label: 'High' },
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const { tone, label } = SEVERITY_META[severity]
  return <Badge tone={tone}>{label}</Badge>
}

const TASK_META: Record<TaskStatus, { tone: BadgeTone; label: string }> = {
  todo: { tone: 'neutral', label: 'To do' },
  in_progress: { tone: 'info', label: 'In progress' },
  done: { tone: 'pass', label: 'Done' },
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { tone, label } = TASK_META[status]
  return <Badge tone={tone}>{label}</Badge>
}
