import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="bg-surface-muted text-ink-subtle mb-3 flex size-11 items-center justify-center rounded-full">
          {icon}
        </div>
      ) : null}
      <p className="text-ink text-sm font-semibold">{title}</p>
      {description ? <p className="text-ink-muted mt-1 max-w-sm text-[13px]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
