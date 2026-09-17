import { cn } from '@/lib/utils'

/** Compliance dial. Colour follows the value: it is a judgement, not a style. */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  className,
}: {
  /** `null` renders an empty, neutral dial — "nothing required yet". */
  value: number | null
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
  className?: string
}) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const tone =
    clamped >= 95 ? 'var(--color-pass-500)' : clamped >= 80 ? 'var(--color-warn-500)' : 'var(--color-fail-500)'

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={value === null ? 'Nothing due yet' : `${clamped}% complete`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={value === null ? 'transparent' : tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-ink text-2xl font-semibold">
          {value === null ? '—' : `${clamped}%`}
        </span>
        {label ? <span className="text-ink-muted text-[11px] font-medium">{label}</span> : null}
        {sublabel ? <span className="text-ink-subtle text-[11px]">{sublabel}</span> : null}
      </div>
    </div>
  )
}

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
