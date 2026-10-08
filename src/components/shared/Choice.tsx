import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A large tappable option for the first screens, where there are only two or three ways forward. */
export function Choice({
  icon: Icon,
  title,
  description,
  onClick,
  primary,
  disabled,
}: {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 sm:p-5',
        primary
          ? 'bg-brand-600 border-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white'
          : 'bg-surface border-line-default hover:border-line-strong active:bg-surface-muted',
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl',
          primary ? 'bg-white/15' : 'bg-surface-muted text-ink-muted',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px] font-bold', !primary && 'text-ink')}>{title}</span>
        <span className={cn('mt-1 block text-sm', primary ? 'text-brand-50' : 'text-ink-muted')}>{description}</span>
      </span>
      <ChevronRight className={cn('mt-3 size-5 shrink-0', primary ? 'text-white' : 'text-ink-subtle')} />
    </button>
  )
}
