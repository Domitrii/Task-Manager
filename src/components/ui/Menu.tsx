import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight popover menu. Closes on outside click, Escape, or after an item
 * is chosen — enough for the header actions without pulling in a menu library.
 */
export function Menu({
  trigger,
  children,
  align = 'right',
  className,
  width = 'w-56',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (props: { close: () => void }) => ReactNode
  align?: 'left' | 'right'
  className?: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={container} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open ? (
        <div
          className={cn(
            'bg-surface border-line shadow-overlay absolute top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border py-1',
            width,
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  tone = 'default',
  description,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-surface-muted flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors',
        tone === 'danger' ? 'text-fail-600 dark:text-fail-500' : 'text-ink',
      )}
    >
      {icon ? <span className="text-ink-subtle mt-0.5 shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {description ? <span className="text-ink-muted block text-xs">{description}</span> : null}
      </span>
    </button>
  )
}

export function MenuDivider() {
  return <div className="bg-line my-1 h-px" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-subtle px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
      {children}
    </p>
  )
}
