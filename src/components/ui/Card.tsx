import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  className,
  children,
  as: Component = 'section',
}: {
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'article'
}) {
  return (
    <Component
      className={cn('bg-surface border-line rounded-card border shadow-card', className)}
    >
      {children}
    </Component>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-line flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-ink text-[15px] leading-6 font-semibold">{title}</h2>
        {description ? <p className="text-ink-muted mt-0.5 text-[13px]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-4 py-4 sm:px-5', className)}>{children}</div>
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-line bg-surface-muted/60 rounded-b-card border-t px-4 py-3 sm:px-5', className)}>
      {children}
    </div>
  )
}
