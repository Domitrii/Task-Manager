import { cn } from '@/lib/utils'
import type { StaffMember } from '@/data/types'
import { avatarTint, useStaffColor } from './avatarColors'

export function Avatar({
  person,
  size = 'md',
  className,
}: {
  person: Pick<StaffMember, 'id' | 'initials' | 'name'> | undefined
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const color = useStaffColor(person?.id)
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
        color !== undefined ? avatarTint(color) : 'bg-surface-muted text-ink-subtle',
        className,
      )}
    >
      {person?.initials ?? '—'}
    </span>
  )
}
