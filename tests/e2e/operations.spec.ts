import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { openDemo, todayAt, visit } from './app.ts'
import { expectToFitScreen } from './layout.ts'

/**
 * The bell for each person, Home's count, ordering what's low, hours and
 * corrected clock times, and the inspection pack.
 */

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first()

/** Device-only mode lets anyone on the staff list take over. Menu entries start with their initials. */
async function switchTo(page: Page, person: string) {
  await visit(page, '/')
  await button(page, /Switch person/).click()
  await page.getByRole('button', { name: new RegExp(`^[A-Z]{2} ${person}`) }).click()
}

test.beforeEach(async ({ page }) => {
  await openDemo(page)
})

test.describe('with the demo venue', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test('the bell tells people about their own tasks; managers hear about everyone’s', async ({ page }) => {
    const lenasTask = (p: Page) => p.getByRole('button').filter({ hasText: 'Update allergen matrix for new autumn menu' })
    await visit(page, '/notifications')
    await expect(lenasTask(page)).toBeVisible()

    await switchTo(page, 'Marcus Bell')
    await visit(page, '/notifications')
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible()
    await expect(lenasTask(page)).toHaveCount(0)
    await expect(page.getByText('Needs sign-off')).toHaveCount(0)

    await switchTo(page, 'Lena Ferreira')
    await visit(page, '/notifications')
    await expect(lenasTask(page)).toBeVisible()
  })

  test('Home’s count is what the bell lists as needing someone, and opens it', async ({ page }) => {
    await visit(page, '/')
    await expect(page.getByText(/\d+ of \d+ done today|All tasks complete/).first()).toBeVisible()
    const badge = page.getByRole('link', { name: /needs? attention\. Show them/ })
    const count = Number((await badge.getAttribute('aria-label'))?.match(/^\d+/)?.[0])
    await badge.click()
    await expect(page).toHaveURL(/\/notifications$/)

    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible()
    // Counted once the list has drawn.
    await expect
      .poll(async () => {
        let listed = 0
        for (const group of ['Missed', 'Overdue', 'Needs attention']) {
          listed += await page.getByRole('region', { name: group, exact: true }).getByRole('button').count()
        }
        return listed
      })
      .toBe(count)
  })

  test('what’s low becomes an order for a manager to check', async ({ page }) => {
    await visit(page, '/stock')
    const panel = page.getByRole('region', { name: 'Order what’s low' })
    const first = panel.getByRole('listitem').first()
    // Names can have commas in them ("Chicken breast, skin-on"), so they're counted from the link.
    const link = first.getByRole('link', { name: 'Start order' })
    const ids = new URL((await link.getAttribute('href')) ?? '', 'http://x').searchParams.get('restock')?.split(',') ?? []
    const listed = await first.locator('span span').nth(1).innerText()
    await link.click()

    await expect(page).toHaveURL(/\/suppliers\/orders$/)
    const form = page.getByRole('dialog', { name: 'New order' })
    await expect(form).toBeVisible()
    const products = form.getByPlaceholder('e.g. Chicken breast, skin-on')
    await expect(products).toHaveCount(ids.length)
    expect(listed.startsWith(await products.first().inputValue())).toBe(true)
    await expectToFitScreen(page)

    // Going back doesn't start another.
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.getByRole('dialog', { name: 'New order' })).toHaveCount(0)

    await switchTo(page, 'Marcus Bell')
    await visit(page, '/stock')
    await expect(page.getByRole('region', { name: 'Order what’s low' })).toHaveCount(0)
  })

  test('hours for the week, and a manager correcting a forgotten clock-in', async ({ page }) => {
    await page.clock.install({ time: todayAt('12:00') })
    await visit(page, '/calendar')
    await button(page, 'Clock in').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Clock in' }).click()
    await expect(page.getByText('Clocked in', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Hours' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Hours worked' })).toBeVisible()
    const amara = page.getByRole('listitem').filter({ hasText: 'Amara Okafor' })
    await expect(amara).toContainText('1 still clocked in')
    await expectToFitScreen(page)

    await visit(page, '/calendar')
    await page.getByRole('button', { name: 'List', exact: true }).click()
    // The list starts with today's shift, the one just clocked into.
    await page.locator('a[href^="/calendar/shift/"]').first().click()
    await button(page, 'Correct times').click()
    const form = page.getByRole('dialog', { name: 'Correct clocked times' })
    const date = await form.getByLabel('Clocked in').inputValue()
    await form.getByLabel('Clocked in').fill(`${date.slice(0, 10)}T08:00`)
    await form.getByLabel('Clocked out').fill(`${date.slice(0, 10)}T07:00`)
    await expect(form.getByText('They can’t clock out before they clock in.')).toBeVisible()
    await form.getByLabel('Clocked out').fill(`${date.slice(0, 10)}T11:30`)
    await expect(form.getByRole('button', { name: 'Save times' })).toBeDisabled()
    await form.getByLabel('Why').fill('Clocked in late, tablet was in the office')
    await form.getByRole('button', { name: 'Save times' }).click()

    await expect(page.getByRole('heading', { name: 'Times corrected' })).toBeVisible()
    await expect(page.getByText(/Clocked in late, tablet was in the office\. Before: 12:00–not clocked out/)).toBeVisible()

    await visit(page, '/calendar/hours')
    // Her row is the whole week; the corrected shift's own 3h 30 (210 minutes) is in the export.
    await expect(amara).not.toContainText('still clocked in')
    await expect(amara).toContainText('1 with corrected times')
    const download = page.waitForEvent('download')
    await button(page, 'Export CSV').click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^hours-\d{4}-\d{2}-\d{2}\.csv$/)
    const csv = readFileSync((await file.path()) ?? '', 'utf8')
    expect(csv).toContain('Clocked in late, tablet was in the office')
    expect(csv).toMatch(/Amara Okafor.*210/)
  })

  test('someone who isn’t a manager sees only their own hours, and can’t correct them', async ({ page }) => {
    await switchTo(page, 'Lena Ferreira')
    await visit(page, '/calendar/hours')
    await expect(page.getByRole('heading', { level: 1, name: 'Your hours' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Amara Okafor' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0)
  })
})

test('the inspection pack has every record, and prints without the app around it', async ({ page }) => {
  await visit(page, '/reports')
  await page.getByRole('link', { name: 'Inspection pack' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inspection pack' })).toBeVisible()
  for (const section of [
    'Summary',
    'Readings out of range, and what was done',
    'Every temperature reading',
    'Sign-off checklists',
    'Deliveries',
    'Issues',
    'Training',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible()
  }
  await expectToFitScreen(page)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'The Copper Larder' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Switch person/ })).toBeHidden()
  await expect(page.getByRole('heading', { level: 2, name: 'Every temperature reading' })).toBeVisible()
})
