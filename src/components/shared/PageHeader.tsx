import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/Button'

export function PageHeader({
  title,
  description,
  actions,
  onBack,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** Shows a back arrow beside the title, for sub-pages reached from another page. */
  onBack?: () => void
  /** Filters or tabs rendered below the title row. */
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {onBack ? (
            <IconButton label="Back" onClick={onBack} className="-mt-1.5 -ml-2 shrink-0 sm:-mt-1">
              <ArrowLeft className="size-5" />
            </IconButton>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-ink text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {description ? (
              <p className="text-ink-muted mt-1 max-w-2xl text-sm">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}
