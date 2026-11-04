import { createContext, use, useEffect } from 'react'

/** What a page says about its own list, in place of the day's. */
export interface HeaderProgress {
  label: string
  done: number
  total: number
}

export const HeaderProgressContext = createContext<(progress: HeaderProgress | null) => void>(() => {})

/** Puts a page's own progress in the top band for as long as the page is open. */
export function useHeaderProgress(label: string, done: number, total: number) {
  const set = use(HeaderProgressContext)
  useEffect(() => {
    set({ label, done, total })
    return () => set(null)
  }, [set, label, done, total])
}
