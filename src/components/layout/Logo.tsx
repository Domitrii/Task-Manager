import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('bg-brand-600 flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
        <path
          d="M7 3v8a2 2 0 0 0 2 2v8a1.2 1.2 0 0 0 2.4 0v-8a2 2 0 0 0 2-2V3"
          stroke="#d5eff2"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M10.2 3v5" stroke="#d5eff2" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17.4 3c1.5 1.2 1.8 4.3 0 5.8V21" stroke="#7bcad6" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** Wordmark with the venue underneath, so a shared tablet always says where it is. */
export function Logo({ venue }: { venue?: string }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5">
      <LogoMark />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-ink text-[15px] font-bold tracking-tight">Mise</span>
        {venue ? <span className="text-ink-muted truncate text-xs">{venue}</span> : null}
      </span>
    </Link>
  )
}
