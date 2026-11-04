import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The tick in its tile. `inverse` is for sitting on the top band. */
export function LogoMark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        inverse ? 'text-brand-700 bg-white' : 'bg-brand-700 text-white',
        className,
      )}
    >
      <Check className="size-[70%]" strokeWidth={3} aria-hidden />
    </span>
  )
}

/** Wordmark with the venue underneath, so a shared tablet always says where it is. */
export function Logo({ venue }: { venue?: string }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5">
      <LogoMark />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-display text-ink text-lg">Mise</span>
        {venue ? <span className="text-ink-muted truncate text-xs">{venue}</span> : null}
      </span>
    </Link>
  )
}
