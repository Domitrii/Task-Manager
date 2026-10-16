import { expect, test } from '@playwright/test'
import { DEVICE_URL, openDemo, openTab, visit } from './app.ts'
import { expectToFitScreen, watchForErrors } from './layout.ts'

/** Every page in the app, as reached from the navigation. */
const PAGES = [
  '/',
  '/tasks',
  '/reports',
  '/temperatures',
  '/temperatures/fridges',
  '/temperatures/freezers',
  '/temperatures/hot-holding',
  '/temperatures/cooking',
  '/temperatures/labels',
  '/temperatures/review',
  '/checklists',
  '/checklists/opening-closing',
  '/checklists/cleaning',
  '/checklists/food-safety',
  '/deliveries',
  '/suppliers',
  '/food-safety',
  '/stock',
  '/templates',
  '/settings',
  // What a QR label on a fridge opens.
  '/scan/eq_wif1',
]

const SETTINGS_TABS = ['Venue', 'Equipment', 'Team', 'Suppliers', 'Templates', 'Data']

test.describe('before any venue exists', () => {
  test('welcome screen fits', async ({ page }) => {
    const errors = watchForErrors(page)
    await page.goto(`${DEVICE_URL}/`)
    await expect(page.getByText('Explore with demo data')).toBeVisible()
    await expectToFitScreen(page)
    expect(errors).toEqual([])
  })

  test('venue setup fits at every step', async ({ page }) => {
    const errors = watchForErrors(page)
    await page.goto(`${DEVICE_URL}/setup`)
    await page.getByText('Set up my venue').click()
    await expect(page).toHaveURL(/\/setup\/venue/)
    await expectToFitScreen(page)
    expect(errors).toEqual([])
  })
})

test.describe('with the demo venue', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page)
  })

  for (const path of PAGES) {
    test(`${path} fits`, async ({ page }) => {
      const errors = watchForErrors(page)
      await visit(page, path)
      await expect(page).toHaveURL(`${DEVICE_URL}${path}`)
      await expectToFitScreen(page)
      expect(errors).toEqual([])
    })
  }

  for (const tab of SETTINGS_TABS) {
    test(`/settings ${tab} tab fits`, async ({ page }) => {
      const errors = watchForErrors(page)
      await visit(page, '/settings')
      await openTab(page, tab)
      await expectToFitScreen(page)
      expect(errors).toEqual([])
    })
  }

  test('/suppliers fits for someone who can’t place orders', async ({ page }) => {
    const errors = watchForErrors(page)
    await visit(page, '/')
    await page.getByRole('button', { name: /Switch person/ }).click()
    await page.getByRole('button', { name: /Lena Ferreira/ }).click()
    await visit(page, '/suppliers')
    await expect(page.getByText(/can place orders/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'New order' })).toHaveCount(0)
    await expectToFitScreen(page)
    expect(errors).toEqual([])
  })

  test('temperature history fits', async ({ page }) => {
    await visit(page, '/temperatures')
    await openTab(page, 'History')
    await expectToFitScreen(page)
  })

  test('template editor fits', async ({ page }) => {
    const errors = watchForErrors(page)
    await visit(page, '/settings')
    await openTab(page, 'Templates')
    await page.getByRole('button', { name: /new template|create/i }).first().click()
    await expect(page).toHaveURL(/\/settings\/templates\//)
    await expectToFitScreen(page)
    expect(errors).toEqual([])
  })
})
