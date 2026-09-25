import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  tone = 'brand',
  className,
}: {
  value: number
  tone?: 'brand' | 'pass' | 'warn' | 'fail'
  className?: string
}) {
  const colors = {
    brand: 'bg-brand-500',
    pass: 'bg-pass-500',
    warn: 'bg-warn-500',
    fail: 'bg-fail-500',
  }
  return (
    <div className={cn('bg-surface-muted h-1.5 w-full overflow-hidden rounded-full', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
