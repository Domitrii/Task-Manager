import { expect, test, type Locator, type Page } from '@playwright/test'
import { openDemo, visit } from './app.ts'

/** A supplier's card, with its past orders, on the Suppliers page. */
const card = (page: Page, name: string) =>
  page
    .locator('section[aria-labelledby="supplier-list"] article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })

/** The upcoming orders laid out in full at the top of the Suppliers page. */
const upcoming = (page: Page) => page.locator('section[aria-labelledby="upcoming"]')

/** Each line in an order's details as "product · price", which a repeat must keep. */
async function linesOf(dialog: Locator): Promise<string[]> {
  const rows = await dialog.locator('li').allInnerTexts()
  return rows.map((text) => {
    const product = text.split('\n')[0].trim()
    const price = text.match(/£[\d,.]+\/\w+/)?.[0] ?? 'no price'
    return `${product} · ${price}`
  })
}

// What ordering does, once, at desktop size. The layout specs cover every width.
test.describe('supplier orders', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'Once, at desktop size, is enough')

  test.beforeEach(async ({ page }) => {
    await openDemo(page)
  })

  test('repeating an order makes a new draft with the same items and prices, leaving the old one', async ({ page }) => {
    await visit(page, '/suppliers')
    const harrow = card(page, 'Harrow & Sons Butchers')
    const history = harrow.getByRole('heading', { name: /^History/ })
    const historyBefore = (await history.textContent()) ?? ""

    await harrow.getByRole('button', { name: /^Delivered/ }).first().click()
    const ordered = page.getByRole('dialog').getByRole('list', { name: 'Ordered items' })
    await expect(ordered.locator('li').first()).toBeVisible()
    // Only what was ordered: extras the driver brought aren't repeated.
    const before = await linesOf(ordered)
    expect(before.length).toBeGreaterThan(0)
    await page.getByRole('dialog').getByRole('button', { name: 'Repeat' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Save draft' }).click()

    await expect(history).toHaveText(historyBefore)
    const draft = upcoming(page).locator('article').filter({ hasText: 'Harrow & Sons Butchers' }).filter({ hasText: 'Draft' })
    await expect.poll(() => linesOf(draft.getByRole('list', { name: 'Items' }))).toEqual(before)
  })

  test('a new order shows on Suppliers with everything the manager put in it', async ({ page }) => {
    await visit(page, '/suppliers')
    await page.getByRole('button', { name: 'New order' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Supplier').selectOption({ label: 'Oakfield Bakery' })
    const deliveryDate = new Date(Date.now() + 5 * 86_400_000).toLocaleDateString('en-CA')
    await dialog.getByLabel('Delivery date').fill(deliveryDate)
    await dialog.getByPlaceholder('e.g. Chicken breast, skin-on').fill('Focaccia trays')
    await dialog.getByLabel('Quantity', { exact: true }).fill('6')
    await dialog.getByLabel(/^Price per kg for/).fill('4.5')
    // Added below the last item, ready to type into.
    await dialog.getByRole('button', { name: 'Add item' }).click()
    const second = dialog.getByPlaceholder('e.g. Chicken breast, skin-on').nth(1)
    await expect(second).toBeFocused()
    await page.keyboard.type('Ciabatta')
    await dialog.getByLabel('Notes').fill('Ask for the rosemary ones')
    await dialog.getByRole('button', { name: 'Save order' }).click()

    const block = upcoming(page).locator('article').filter({ hasText: 'Focaccia trays' })
    await expect(block).toContainText('Oakfield Bakery')
    await expect(block).toContainText('Expected delivery')
    await expect(block).toContainText('6 kg × £4.50/kg')
    await expect(block).toContainText('£27.00')
    await expect(block).toContainText('Ask for the rosemary ones')
    await expect(block).toContainText('No deadline')
    await expect(block).toContainText('Ciabatta')
  })

  test('a product ordered before comes with its last price', async ({ page }) => {
    await visit(page, '/suppliers')
    await card(page, 'Harrow & Sons Butchers').getByRole('button', { name: 'New order' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('e.g. Chicken breast, skin-on').fill('beef mince 20%')

    const hint = await dialog.getByText(/^Last time £/).innerText()
    const remembered = Number(hint.match(/£([\d.]+)/)?.[1])
    await expect(dialog.getByLabel(/^Price per kg for/)).toHaveValue(String(remembered))
  })

  test('checking an order in records a delivery against it, discrepancies and all', async ({ page }) => {
    await visit(page, '/deliveries')
    const waiting = page.locator('section[aria-labelledby="due-today"]')
    await waiting.locator('li').filter({ hasText: 'Greenfield Produce' }).getByRole('button', { name: 'Check in' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Mark all received' }).click()
    for (const field of await dialog.getByLabel(/^Temperature of/).all()) await field.fill('4')
    await dialog.getByRole('button', { name: 'Show details for Baby spinach' }).click()
    await dialog.getByLabel('Quantity of Baby spinach received').fill('3')
    await dialog.getByRole('button', { name: 'Complete check-in' }).click()

    await expect(page.getByText('Order checked in')).toBeVisible()
    await expect(waiting.locator('li').filter({ hasText: 'Greenfield Produce' })).toHaveCount(0)
    await expect(page.locator('tbody tr').filter({ hasText: 'Greenfield Produce' }).first()).toContainText('Discrepancies')

    await visit(page, '/suppliers')
    const latest = card(page, 'Greenfield Produce').getByRole('button', { name: /^Delivered/ }).first()
    await expect(latest).toContainText('Discrepancies')
  })

  test('staff see orders without changing them, and check one in under their own name', async ({ page }) => {
    await visit(page, '/')
    await page.getByRole('button', { name: /Switch person/ }).click()
    await page.getByRole('button', { name: /^LF Lena Ferreira/ }).click()

    await visit(page, '/suppliers')
    await expect(card(page, 'Harrow & Sons Butchers')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New order' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit order' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Repeat this order' })).toHaveCount(0)

    await visit(page, '/deliveries')
    await expect(page.getByRole('button', { name: 'Move delivery date' })).toHaveCount(0)
    const waiting = page.locator('section[aria-labelledby="due-today"]')
    await waiting.locator('li').filter({ hasText: 'Northern Catch Seafood' }).getByRole('button', { name: 'Check in' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Mark all received' }).click()
    for (const field of await dialog.getByLabel(/^Temperature of/).all()) await field.fill('3')
    await dialog.getByLabel('Temperature of Cold-water prawns').fill('-18')
    await dialog.getByRole('button', { name: 'Complete check-in' }).click()
    await expect(page.getByText('Order checked in')).toBeVisible()

    await page.locator('tbody tr').filter({ hasText: 'Northern Catch Seafood' }).first().click()
    await expect(page.getByRole('dialog')).toContainText('Lena Ferreira')
  })

  test('the day’s progress bar credits whoever ticks something off', async ({ page }) => {
    await visit(page, '/tasks')
    const bar = page.getByRole('button', { name: /Show who did what/ })
    const label = async () => (await bar.getAttribute('aria-label')) ?? ''
    const done = (text: string) => Number(text.match(/Today: (\d+) of/)?.[1])
    const amara = (text: string) => Number(text.match(/Amara Okafor (\d+)/)?.[1] ?? 0)
    const before = await label()

    // Due today, and Amara is the one on the device.
    await page
      .locator('li')
      .filter({ hasText: 'Label and date everything in the walk-in' })
      .getByRole('button', { name: 'Mark complete' })
      .click()

    await expect.poll(async () => done(await label())).toBe(done(before) + 1)
    expect(amara(await label())).toBe(amara(before) + 1)
  })
})
