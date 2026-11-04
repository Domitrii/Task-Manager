import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

/**
 * - `sheet`: a bottom sheet on phones, centred on bigger screens. Staff often
 *   record checks one-handed at the pass, so actions stay thumb-reachable.
 * - `page`: fills a phone like a page of its own, for a form worth the room.
 * - `alert`: a short question, centred everywhere, for something hard to undo.
 */
export type ModalVariant = 'sheet' | 'page' | 'alert'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  variant = 'sheet',
  icon,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: ModalVariant
  /** Shown before the title. */
  icon?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }
  const page = variant === 'page'
  const alert = variant === 'alert'

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center',
        alert ? 'items-center p-4' : 'items-end sm:items-center sm:p-6',
      )}
    >
      <div
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative flex w-full flex-col',
          page ? 'bg-app sm:bg-surface h-dvh sm:h-auto sm:max-h-[92vh] sm:rounded-2xl' : 'bg-surface max-h-[92vh]',
          variant === 'sheet' && 'rounded-t-2xl sm:rounded-2xl',
          alert && 'max-w-md rounded-2xl',
          'shadow-overlay',
          !alert && widths[size],
        )}
      >
        {variant === 'sheet' ? (
          // Grab handle: tells a phone user this is a sheet they can dismiss.
          <span className="bg-line-strong mx-auto mt-2 h-1 w-10 shrink-0 rounded-full sm:hidden" aria-hidden />
        ) : null}
        <div
          className={cn(
            'flex items-start gap-3 px-5 pt-3 pb-2 sm:pt-5',
            page &&
              'bg-surface items-center pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:items-start sm:bg-transparent sm:pt-5 sm:pb-2',
            alert && 'pt-5',
          )}
        >
          {page ? (
            <IconButton label="Back" variant="secondary" onClick={onClose} className="-ml-1 shrink-0 sm:hidden">
              <ArrowLeft className="size-5" />
            </IconButton>
          ) : null}
          {icon ? <span className="text-fail-600 dark:text-fail-500 mt-0.5 shrink-0">{icon}</span> : null}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-ink text-xl leading-snug font-bold">{title}</h2>
            {description ? <p className="text-ink-muted mt-0.5 text-sm">{description}</p> : null}
          </div>
          {!alert ? (
            <IconButton label="Close" size="sm" onClick={onClose} className={cn('shrink-0', page && 'hidden sm:inline-flex')}>
              <X className="size-4" />
            </IconButton>
          ) : null}
        </div>

        {children ? (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-5 py-3',
              !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
            )}
          >
            {children}
          </div>
        ) : null}

        {footer ? (
          <div
            className={cn(
              'flex flex-col gap-2 px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-5',
              !alert && 'sm:flex-row sm:justify-end',
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
