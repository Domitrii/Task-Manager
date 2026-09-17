import { cn } from '@/lib/utils'
import type { StaffMember } from '@/data/types'

/** Deterministic tint per person so the same face keeps the same colour. */
const PALETTE = [
  'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
  'bg-info-100 text-info-700 dark:bg-info-500/15 dark:text-info-500',
  'bg-warn-100 text-warn-700 dark:bg-warn-500/15 dark:text-warn-500',
  'bg-pass-100 text-pass-700 dark:bg-pass-500/15 dark:text-pass-500',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
]

function tintFor(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function Avatar({
  person,
  size = 'md',
  className,
}: {
  person: Pick<StaffMember, 'id' | 'initials' | 'name'> | undefined
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    xs: 'size-6 text-[10px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-xs',
    lg: 'size-11 text-sm',
  }
  return (
    <span
      title={person?.name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizes[size],
        person ? tintFor(person.id) : 'bg-surface-muted text-ink-subtle',
        className,
      )}
    >
      {person?.initials ?? '—'}
    </span>
  )
}
