import type { ReactNode } from 'react'

/** Leaves room at the foot of a page that has a `PinnedAction`. */
export const WITH_PINNED_ACTION = 'space-y-3.5 pb-16 lg:pb-0'

/** A page's main action, held just above the tab bar where a thumb can reach it. */
export function PinnedAction({ children }: { children: ReactNode }) {
  return (
    <div
      data-pinned-action
      className="bg-app/95 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-(--layer-pinned) space-y-1.5 px-4 pt-2 pb-2.5 sm:px-6 lg:static lg:bg-transparent lg:px-0 lg:pb-0"
    >
      {children}
    </div>
  )
}
