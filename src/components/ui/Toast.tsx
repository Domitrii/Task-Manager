import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn, createId } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'

interface ToastEntry {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastApi {
  toast: (entry: Omit<ToastEntry, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONES: Record<ToastTone, { icon: typeof CheckCircle2; className: string; tint: string }> = {
  success: { icon: CheckCircle2, className: 'text-pass-600 dark:text-pass-500', tint: 'bg-pass-50 dark:bg-[#1f2d24]' },
  error: { icon: AlertTriangle, className: 'text-fail-600 dark:text-fail-500', tint: 'bg-fail-50 dark:bg-[#35201f]' },
  info: { icon: Info, className: 'text-info-600 dark:text-info-500', tint: 'bg-surface' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([])

  const dismiss = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const api = useMemo<ToastApi>(() => {
    const toast = (entry: Omit<ToastEntry, 'id'>) => {
      const id = createId('toast')
      setEntries((current) => [...current, { ...entry, id }])
      setTimeout(() => dismiss(id), 4500)
    }
    return {
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
    }
  }, [dismiss])

  return (
    <ToastContext value={api}>
      {children}
      {/* Just above the tab bar on phones and tablets, and above a page's pinned
          action. With a sheet open it moves to the top, where it can't sit over
          the sheet's "Save and next". */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-(--layer-toast) print:hidden flex flex-col items-center gap-2 p-3 lg:inset-x-auto lg:right-0 lg:bottom-0 lg:items-end lg:p-4 [body:has([data-pinned-action])_&]:bottom-[calc(8rem+env(safe-area-inset-bottom))] [body:has([data-pinned-action])_&]:lg:bottom-0 [body:has([role=dialog])_&]:top-[env(safe-area-inset-top)] [body:has([role=dialog])_&]:bottom-auto [body:has([role=dialog])_&]:lg:top-auto [body:has([role=dialog])_&]:lg:bottom-0">
        {entries.map((entry) => {
          const { icon: Icon, className, tint } = TONES[entry.tone]
          return (
            <div
              key={entry.id}
              role="status"
              className={cn('shadow-raised pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl p-3.5', tint)}
            >
              <Icon className={cn('mt-0.5 size-4.5 shrink-0', className)} />
              <div className="min-w-0 flex-1">
                <p className="text-ink text-sm font-medium">{entry.title}</p>
                {entry.description ? (
                  <p className="text-ink-muted mt-0.5 text-[13px]">{entry.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                aria-label="Dismiss"
                className="text-ink-subtle hover:text-ink -m-1 p-1"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastApi {
  const context = use(ToastContext)
  if (!context) throw new Error('useToast must be used inside a <ToastProvider>')
  return context
}
