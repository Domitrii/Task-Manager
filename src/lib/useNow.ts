import { useEffect, useState } from 'react'

/**
 * A clock that ticks on an interval, so "due" checks roll over to "overdue"
 * without the user reloading. One minute is plenty for compliance windows.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
