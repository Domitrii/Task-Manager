import { expect, test, type Locator, type Page } from '@playwright/test'
import { openDemo, todayAt, visit } from './app.ts'

/**
 * What's drawn over what (the layers in `src/index.css`). Each check asks the
 * browser what's actually on top at the middle of something that should be
 * seen, so a sticky heading or a bar sitting over it is caught.
 */

/**
 * Fails with whatever covers any of these, and where. Each is tried near its
 * left edge, in the middle and near its right edge, since sticky parts (a
 * grid's hours, say) sit along one side. Only what's on screen is checked.
 */
async function expectOnTop(items: Locator) {
  const covered = await items.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const box = element.getBoundingClientRect()
      const y = box.top + box.height / 2
      if (box.width === 0 || y < 0 || y >= innerHeight) return []
      return [box.left + 12, box.left + box.width / 2, box.right - 12].flatMap((x) => {
        if (x < 0 || x >= innerWidth) return []
        const hit = document.elementFromPoint(x, y)
        if (hit && (hit === element || element.contains(hit))) return []
        const label = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
        return [`“${label}” at x ${Math.round(x)} is under ${hit ? hit.outerHTML.replace(/\s+/g, ' ').slice(0, 140) : 'nothing'}`]
      })
    }),
  )
  expect(covered).toEqual([])
}

const accountMenu = (page: Page) => page.getByRole('button', { name: /^Signed in as/ }).filter({ visible: true }).first()
/** The open menu's entries: it opens on its own layer, straight under `body`. */
const menuEntries = (page: Page) => page.locator('body > div.fixed button')

test.beforeEach(async ({ page }) => {
  await openDemo(page)
})

test('the account menu opens over the week grid, wherever the page is scrolled', async ({ page }) => {
  await visit(page, '/calendar')
  const grid = page.getByRole('region', { name: 'Week grid' })
  await expect(grid).toBeVisible()

  for (const scroll of ['top', 'grid under the top bar'] as const) {
    if (scroll === 'grid under the top bar') {
      // The grid's sticky day headings right where the menu opens.
      await grid.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 40))
    }
    await accountMenu(page).click()
    await expect(menuEntries(page).first()).toBeVisible()
    await expectOnTop(menuEntries(page))
    await page.keyboard.press('Escape')
    await expect(menuEntries(page)).toHaveCount(0)
  }
})

test('a long account menu stays on screen, over the tab bar', async ({ page }) => {
  // Device-only, the menu lists everyone to switch to, which is long on a phone.
  await visit(page, '/')
  await accountMenu(page).click()
  const panel = page.locator('body > div.fixed').filter({ has: page.getByRole('button', { name: 'Your profile' }) })
  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  const viewport = page.viewportSize()
  expect(box && viewport && box.y >= 0 && box.y + box.height <= viewport.height).toBe(true)
  await panel.evaluate((element) => element.scrollTo(0, element.scrollHeight))
  await expectOnTop(menuEntries(page))
})

test('the Clock in bar stays over the week grid', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The bar is pinned to the screen on phones and tablets')
  await page.clock.install({ time: todayAt('12:00') })
  await visit(page, '/calendar')
  const grid = page.getByRole('region', { name: 'Week grid' })
  const bar = page.locator('[data-pinned-action]')
  await expect(bar).toBeVisible()
  // The grid's sticky day headings, and its hours down the side, right behind the bar.
  const barTop = (await bar.boundingBox())?.y ?? 0
  await grid.evaluate((element, top) => {
    element.scrollTop = 0
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - top - 8)
  }, barTop)
  await expectOnTop(bar.locator('button'))
})

test('a sheet covers the bars, and a menu inside the page opens over the tab bar', async ({ page }) => {
  await visit(page, '/tasks')
  await page.getByRole('button', { name: 'More actions' }).filter({ visible: true }).first().click()
  await expect(menuEntries(page).first()).toBeVisible()
  await expectOnTop(menuEntries(page))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Log' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expectOnTop(sheet.getByRole('button'))
})
