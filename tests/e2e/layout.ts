import { expect, type Page } from '@playwright/test'

/**
 * Runs in the page. Lists anything that doesn't fit the screen:
 * - the page itself scrolling sideways;
 * - something sticking out past the edge of the screen;
 * - a sideways-scrolling area (a table, say) with buttons or fields hidden off
 *   to the side. Swipeable chip and tab strips (`scrollbar-none`) are meant to
 *   scroll, and read-only tables may, so long as no control is out of sight;
 * - content cut off by a container that hides overflow, other than text that
 *   ends in an ellipsis on purpose.
 */
function findLayoutProblems(): string[] {
  const viewport = document.documentElement.clientWidth
  const problems = new Set<string>()

  const describe = (el: Element) => {
    const text = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('placeholder') || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 60)
    return `<${el.tagName.toLowerCase()}> "${text}"`
  }
  const box = (el: Element) => {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 ? rect : null
  }
  const clippedByAncestor = (el: Element) => {
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX !== 'visible') return true
    }
    return false
  }
  // Screen-reader-only text is 1px wide and clipped on purpose.
  const srOnly = (el: Element) => el.closest('.sr-only') !== null

  const width = document.documentElement.scrollWidth
  if (width > viewport + 1) problems.add(`the page scrolls sideways (${width}px wide on a ${viewport}px screen)`)

  for (const el of document.querySelectorAll('body *')) {
    const rect = box(el)
    if (!rect || srOnly(el)) continue
    const style = getComputedStyle(el)

    if ((rect.right > viewport + 1 || rect.left < -1) && !clippedByAncestor(el)) {
      problems.add(`${describe(el)} sticks out of the screen (${Math.round(rect.left)}px to ${Math.round(rect.right)}px)`)
    }

    const overflowing = el.scrollWidth > el.clientWidth + 1
    if (!overflowing) continue

    if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
      if (el.classList.contains('scrollbar-none')) continue
      const hidden = [...el.querySelectorAll('button, a[href], input, select, textarea')].filter((control) => {
        const controlRect = box(control)
        return controlRect && (controlRect.right > rect.right + 1 || controlRect.left < rect.left - 1)
      })
      if (hidden.length > 0) {
        problems.add(
          `${describe(el).slice(0, 50)}… scrolls sideways with ${hidden.length} control(s) out of sight, e.g. ${describe(hidden[0])}`,
        )
      }
    } else if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && style.textOverflow !== 'ellipsis') {
      // A line-clamped or truncated child is fine; anything else is being cut off.
      const cut = [...el.children].find((child) => {
        const childRect = box(child)
        if (!childRect || srOnly(child) || getComputedStyle(child).position === 'absolute') return false
        return childRect.right > rect.right + 1
      })
      if (cut) problems.add(`${describe(cut)} is cut off by ${describe(el).slice(0, 50)}`)
    }
  }
  return [...problems]
}

/** Everything on the page as it is now that doesn't fit the screen. */
export async function layoutProblems(page: Page): Promise<string[]> {
  // Let fonts, lazy pages and transitions settle before measuring.
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  return page.evaluate(findLayoutProblems)
}

/** Fails the test with a readable list of everything that doesn't fit. */
export async function expectToFitScreen(page: Page) {
  expect(await layoutProblems(page), 'layout problems').toEqual([])
}

/** Collects uncaught errors, so a page that crashes at one width fails there. */
export function watchForErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}
