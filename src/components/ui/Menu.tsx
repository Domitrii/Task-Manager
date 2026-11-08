import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Space kept between the menu and its button, and between the menu and the screen's edge. */
const GAP = 6
const EDGE = 8

/**
 * Lightweight popover menu. Closes on outside click, Escape, or after an item
 * is chosen — enough for the header actions without pulling in a menu library.
 *
 * It opens on a layer of its own over the whole app (`--layer-popover`), placed
 * against its button, so neither the page it's on nor the bars around it can
 * cover it. Below its button if it fits, above if there's more room there, and
 * scrolling inside itself if it fits neither way.
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
  const [place, setPlace] = useState<CSSProperties | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!container.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
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

  // Placed before it's painted, and again whenever the page or anything in it scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const button = container.current?.getBoundingClientRect()
      if (!button) return
      const below = window.innerHeight - button.bottom - GAP - EDGE
      const above = button.top - GAP - EDGE
      const height = panel.current?.scrollHeight ?? 0
      const upwards = height > below && above > below
      setPlace({
        ...(upwards ? { bottom: window.innerHeight - button.top + GAP } : { top: button.bottom + GAP }),
        ...(align === 'right'
          ? { right: Math.max(EDGE, document.documentElement.clientWidth - button.right) }
          : { left: Math.max(EDGE, button.left) }),
        maxHeight: Math.max(120, upwards ? above : below),
      })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      setPlace(null)
    }
  }, [open, align])

  return (
    <div ref={container} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open
        ? createPortal(
            <div
              ref={panel}
              // Hidden for the moment it takes to measure and place it.
              style={place ?? { visibility: 'hidden', top: 0, left: 0 }}
              className={cn(
                'bg-surface border-line shadow-overlay fixed z-(--layer-popover) max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border py-1',
                width,
              )}
            >
              {children({ close: () => setOpen(false) })}
            </div>,
            document.body,
          )
        : null}
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
        'hover:bg-surface-muted flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors',
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
    <p className="text-ink-muted px-3 pt-2 pb-1 text-xs font-medium">
      {children}
    </p>
  )
}
