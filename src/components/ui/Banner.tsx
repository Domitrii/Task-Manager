import type { ReactNode } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONES = {
  pass: {
    icon: CheckCircle2,
    box: 'bg-pass-50 text-pass-700 dark:bg-pass-500/12 dark:text-pass-500',
  },
  warn: {
    icon: TriangleAlert,
    box: 'bg-warn-50 text-warn-700 dark:bg-warn-500/12 dark:text-warn-500',
  },
}

/** A line across a page saying what just happened, or what's holding things up. */
export function Banner({
  tone,
  title,
  children,
  className,
}: {
  tone: keyof typeof TONES
  title: string
  children?: ReactNode
  className?: string
}) {
  const { icon: Icon, box } = TONES[tone]
  return (
    <div role="status" className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3', box, className)}>
      <Icon className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children ? <p className="mt-0.5 text-[13px] opacity-90">{children}</p> : null}
      </div>
    </div>
  )
}
