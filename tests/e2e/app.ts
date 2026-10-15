import { expect, type Page } from '@playwright/test'

/** The device-only copy of the app: no sign-in, everything kept in the browser. */
export const DEVICE_URL = 'http://localhost:5199'
/** The copy with Supabase keys, for the sign-in and team screens. */
export const ACCOUNTS_URL = 'http://localhost:5198'

/** Opens the sample restaurant, as someone looking around for the first time would. */
export async function openDemo(page: Page) {
  await page.goto(`${DEVICE_URL}/`)
  await page.getByText('Explore with demo data').click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

/** Goes to a page and waits for its heading, so lazily loaded pages are really there. */
export async function visit(page: Page, path: string) {
  await page.goto(`${DEVICE_URL}${path}`)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

/** Picks a tab by its label; some tabs also show a count after it, like "Team 1". */
export async function openTab(page: Page, label: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}\\s*\\d*$`) }).first().click()
}
