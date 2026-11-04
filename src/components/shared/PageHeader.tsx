import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/Button'

/**
 * A page's title. Top-level pages lead with a large title; pages reached from
 * another one get a white bar along the top with the way back.
 */
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
  /** Makes this a sub-page, with a back arrow beside the title. */
  onBack?: () => void
  /** Filters or tabs rendered below the title row. */
  children?: ReactNode
  className?: string
}) {
  if (onBack) {
    return (
      <header className={cn('flex flex-col gap-4', className)}>
        <div className="bg-surface shadow-card -mx-4 -mt-5 flex min-h-16 items-center gap-3 px-4 py-2.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <IconButton label="Back" variant="secondary" onClick={onBack} className="shrink-0">
            <ArrowLeft className="size-5" />
          </IconButton>
          <h1 className="font-display text-ink min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
        </div>
        {description ? <p className="text-ink-muted max-w-2xl text-sm">{description}</p> : null}
        {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
        {children}
      </header>
    )
  }

  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-ink text-[28px] leading-tight font-bold">{title}</h1>
          {description ? <p className="text-ink-muted mt-1 max-w-2xl text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}
