import { Check, CircleAlert, Clock } from 'lucide-react'
import type { DeliveryStatus } from '@/data/types'
import { Badge } from '@/components/ui/Badge'

export function ExpectedBadge({ overdue = false }: { overdue?: boolean }) {
  return overdue ? (
    <Badge tone="fail" icon={<CircleAlert className="size-3.5" />}>
      Overdue
    </Badge>
  ) : (
    <Badge icon={<Clock className="size-3.5" />}>Expected</Badge>
  )
}

export function ReceivedBadge({ status }: { status: DeliveryStatus }) {
  if (status === 'accepted') {
    return (
      <Badge tone="pass" icon={<Check className="size-3.5" />}>
        Accepted
      </Badge>
    )
  }
  return (
    <Badge tone={status === 'rejected' ? 'fail' : 'warn'} icon={<CircleAlert className="size-3.5" />}>
      {status === 'rejected' ? 'Rejected' : 'Part rejected'}
    </Badge>
  )
}
