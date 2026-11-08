import { expect, test } from '@playwright/test'
import { ACCOUNTS_URL, DEVICE_URL, openDemo, openTab } from './app.ts'
import { expectToFitScreen, watchForErrors } from './layout.ts'
import { fakeSupabase, signedIn, TEAM } from './supabase.ts'

/**
 * The screens that only exist with Supabase: signing in, choosing a team and
 * the team's own settings. Nothing real is behind the keys this copy of the
 * app has, so each test answers Supabase's requests itself.
 */

test.describe('signed out', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSupabase(page)
    await page.goto(`${ACCOUNTS_URL}/`)
  })

  test('sign in fits', async ({ page }) => {
    await expect(page.getByLabel(/email/i).first()).toBeVisible()
    await expectToFitScreen(page)
  })

  test('create account fits', async ({ page }) => {
    await page.getByRole('button', { name: /create an account|sign up/i }).first().click()
    await expectToFitScreen(page)
  })

  test('forgot password fits', async ({ page }) => {
    await page.getByRole('button', { name: /forgot/i }).click()
    await expectToFitScreen(page)
  })
})

test.describe('signed in, not in a team yet', () => {
  test('choosing a team fits', async ({ page }) => {
    await fakeSupabase(page)
    await signedIn(page, { team: null })
    await page.goto(`${ACCOUNTS_URL}/`)
    await expect(page.getByText('Join your team')).toBeVisible()
    await expectToFitScreen(page)

    await page.getByRole('button', { name: /Join a team/ }).click()
    await expectToFitScreen(page)
  })

  test('creating a team fits', async ({ page }) => {
    await fakeSupabase(page)
    await signedIn(page, { team: null })
    await page.goto(`${ACCOUNTS_URL}/`)
    await page.getByRole('button', { name: /Create a team/ }).click()
    await expectToFitScreen(page)
  })

  test('waiting to be let in fits', async ({ page }) => {
    await fakeSupabase(page, { pendingRequest: true })
    await signedIn(page, { team: null })
    await page.goto(`${ACCOUNTS_URL}/`)
    await expect(page.getByText(TEAM.name).first()).toBeVisible()
    await expectToFitScreen(page)
  })

  test('giving a name fits', async ({ page }) => {
    await fakeSupabase(page, { member: true })
    await signedIn(page, { team: TEAM, name: '' })
    await page.goto(`${ACCOUNTS_URL}/`)
    await expect(page.getByRole('textbox').first()).toBeVisible()
    await expectToFitScreen(page)
  })
})

test.describe('in a team', () => {
  test.beforeEach(async ({ page }) => {
    // The demo venue, kept on this device from before it synced, becomes the new team's records.
    await openDemo(page)
    const records = await page.evaluate(() => localStorage.getItem('mise.appdata.v1'))
    expect(records, 'demo data saved on the device').toBeTruthy()
    await page.goto('about:blank')
    await page.addInitScript((saved) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('mise.appdata.v1', saved ?? '')
        sessionStorage.setItem('seeded', 'yes')
      }
    }, records)
    await fakeSupabase(page, { member: true })
    await signedIn(page, { team: TEAM })
  })

  for (const [name, path, tab] of [
    ['team settings', '/settings/manage', 'Team'],
    ['profile', '/profile', null],
    ['sync settings', '/settings/sync', null],
    ['notifications, with someone asking to join', '/notifications', null],
    ['temperature review', '/temperatures/review', null],
    ['today, with someone asking to join', '/', null],
  ] as const) {
    test(`${name} fits`, async ({ page }) => {
      const errors = watchForErrors(page)
      await page.goto(`${ACCOUNTS_URL}${path}`)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      if (tab) await openTab(page, tab)
      await expectToFitScreen(page)
      expect(errors).toEqual([])
    })
  }
})

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page)
    const records = await page.evaluate(() => localStorage.getItem('mise.appdata.v1'))
    await page.goto('about:blank')
    await page.addInitScript((saved) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('mise.appdata.v1', saved ?? '')
        sessionStorage.setItem('seeded', 'yes')
      }
    }, records)
    await fakeSupabase(page, { member: true })
    await signedIn(page, { team: TEAM })
  })

  test('the profile menu says how sync stands, and signing out asks first', async ({ page }) => {
    await page.goto(`${ACCOUNTS_URL}/`)
    await page.getByRole('button', { name: /^Signed in as/ }).click()
    await expect(page.getByRole('button', { name: /Sync now$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Your profile' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Team' })).toBeVisible()
    await expectToFitScreen(page)

    await page.getByRole('button', { name: 'Sign out' }).click()
    const alert = page.getByRole('alertdialog')
    await expect(alert.getByRole('heading', { name: 'Sign out?' })).toBeVisible()
    await expectToFitScreen(page)
    await alert.getByRole('button', { name: 'Cancel' }).click()
    await expect(alert).toHaveCount(0)
  })

  test('the sync page offers a sync, unless the device is offline', async ({ page, context }) => {
    await page.goto(`${ACCOUNTS_URL}/settings/sync`)
    await expect(page.getByRole('heading', { name: 'Sync', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sync now' }).first()).toBeEnabled()

    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect(page.getByRole('button', { name: 'Sync now' }).first()).toBeDisabled()
    await context.setOffline(false)
  })
})

// Keeps the two copies of the app from being confused in a failure message.
test('the device-only copy has no sign-in', async ({ page }) => {
  await page.goto(`${DEVICE_URL}/`)
  await expect(page.getByText('Explore with demo data')).toBeVisible()
})
