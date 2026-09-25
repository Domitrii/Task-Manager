import type { FormEvent, ReactNode } from 'react'
import { LogoMark } from '@/components/layout/Logo'

/**
 * Full-height page with no sidebar or tabs, for doing one thing at a time on a
 * phone: setup, or logging a reading from a scanned label. The main action is
 * pinned to the bottom where a thumb can reach it.
 */
export function FocusFrame({
  top,
  children,
  actions,
  onSubmit,
}: {
  /** Replaces the wordmark in the top bar, e.g. with step progress. */
  top?: ReactNode
  children: ReactNode
  /** Pinned action bar. */
  actions?: ReactNode
  /** Makes the whole frame a form, so the keyboard's Go key moves on. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
}) {
  const content = (
    <>
      <header className="bg-app/95 sticky top-0 z-10 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3">
          {top ?? (
            <>
              <LogoMark />
              <span className="text-ink text-[15px] font-bold tracking-tight">Mise</span>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-10 sm:px-6">
        <div className="mx-auto w-full max-w-xl">{children}</div>
      </main>

      {actions ? (
        <div className="bg-surface/95 border-line sticky bottom-0 z-10 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {actions}
          </div>
        </div>
      ) : null}
    </>
  )

  return onSubmit ? (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      {content}
    </form>
  ) : (
    <div className="flex min-h-full flex-col">{content}</div>
  )
}

export function FocusHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="pt-4 pb-6 sm:pt-8">
      <h1 className="text-ink text-2xl leading-tight font-bold tracking-tight sm:text-[28px]">{title}</h1>
      {description ? <p className="text-ink-muted mt-1.5 text-[15px]">{description}</p> : null}
    </div>
  )
}
