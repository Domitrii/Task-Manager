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

const TONES: Record<ToastTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-pass-600 dark:text-pass-500' },
  error: { icon: AlertTriangle, className: 'text-fail-600 dark:text-fail-500' },
  info: { icon: Info, className: 'text-info-600 dark:text-info-500' },
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
      {/* Top on phones and tablets, where the tab bar and bottom sheets own the
          bottom edge; a toast there would sit over "Save and next". */}
      <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[60] flex flex-col items-center gap-2 p-3 lg:inset-x-auto lg:top-auto lg:right-0 lg:bottom-0 lg:items-end lg:p-4">
        {entries.map((entry) => {
          const { icon: Icon, className } = TONES[entry.tone]
          return (
            <div
              key={entry.id}
              role="status"
              className="bg-surface border-line shadow-overlay pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5"
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
