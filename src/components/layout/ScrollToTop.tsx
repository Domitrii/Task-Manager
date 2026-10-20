import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Every page opens at its top, whichever page you came from and however you
 * got there, Back included. Only the path counts, so switching a tab or filter
 * kept in the query string leaves you where you were.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  // Otherwise the browser puts Back where you left that page, after we've scrolled up.
  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])

  // Before paint, so the new page never flashes at the old page's scroll.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
