import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS_URL, openDemo, openTab, visit } from './app.ts'
import { expectToFitScreen } from './layout.ts'
import { fakeSupabase, json, ME, PEOPLE, signedIn, TEAM, withDemoRecords, type Call } from './supabase.ts'

/**
 * Who can do what, and whose name goes on a record: the forms, taking people
 * out of a team, signing in and out, and a shared kitchen tablet.
 */

const PHOTO = {
  name: 'probe.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first()

/** Device-only mode lets anyone on the staff list take over. */
async function switchTo(page: Page, person: string) {
  await visit(page, '/')
  await button(page, /Switch person/).click()
  // Menu entries start with the person's initials, as in "LF Lena Ferreira".
  await page.getByRole('button', { name: new RegExp(`^[A-Z]{2} ${person}`) }).click()
}

/** The temperature sheet starts with what to check; the rest of the form follows the choice. */
async function chooseAppliance(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: /^Walk-in Fridge 1/ }).first().click()
}

async function logSheet(page: Page, choice: string) {
  await button(page, 'Log').click()
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${choice}`) }).click()
}

const called = (calls: Call[], path: string) => calls.filter((call) => call.path === path)

test.describe('whose name goes on a record', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test.beforeEach(async ({ page }) => {
    await openDemo(page)
  })

  test('someone who isn’t a manager records in their own name, as it happens', async ({ page }) => {
    await switchTo(page, 'Lena Ferreira')

    await logSheet(page, 'Temperature')
    await chooseAppliance(page)
    const reading = page.getByRole('dialog')
    await expect(reading.getByText(/Checked by Lena Ferreira\s*just now/)).toBeVisible()
    await expect(reading.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await logSheet(page, 'Sign-off checklist')
    // One not signed off yet today, so it opens as a fresh form.
    await page.getByRole('dialog').getByRole('listitem').filter({ hasText: /\d+ checks/ }).first().getByRole('button').click()
    const checklist = page.getByRole('dialog')
    await expect(checklist.getByLabel('Completed by')).toHaveValue('Lena Ferreira')
    await expect(checklist.getByLabel('Completed by')).toHaveAttribute('readonly', '')
    await page.keyboard.press('Escape')

    await logSheet(page, 'Delivery')
    const delivery = page.getByRole('dialog')
    await expect(delivery.getByLabel('Checked by')).toHaveValue('Lena Ferreira')
    await expect(delivery.getByLabel('Checked by')).toHaveAttribute('readonly', '')
    await expect(delivery.getByLabel('Received')).toHaveAttribute('readonly', '')
  })

  test('a manager can record for someone else, and the record says who entered it', async ({ page }) => {
    await visit(page, '/')
    await logSheet(page, 'Temperature')
    await chooseAppliance(page)
    const reading = page.getByRole('dialog')
    await reading.getByRole('button', { name: 'Change', exact: true }).click()
    await reading.getByLabel('Checked by').selectOption({ label: 'Tom Whitfield' })
    await reading.locator('#temperature-value').fill('3')
    await reading.locator('input[type="file"]').setInputFiles(PHOTO)
    await reading.getByRole('button', { name: 'Save and close' }).click()
    await expect(reading).toHaveCount(0)

    await visit(page, '/temperatures/records')
    await openTab(page, 'History')
    // The phone and desktop layouts are both on the page; only one shows.
    await expect(page.getByText(/entered by Amara Okafor/i).filter({ visible: true }).first()).toBeVisible()
  })
})

test.describe('in a team', () => {
  test.beforeEach(async ({ page }) => {
    await withDemoRecords(page, openDemo)
    await signedIn(page, { team: TEAM })
  })

  test('the owner takes someone out of the team, after asking', async ({ page }) => {
    const calls = await fakeSupabase(page, { member: true })
    await page.goto(`${ACCOUNTS_URL}/settings/manage?tab=staff`)
    await button(page, 'Remove Alex Morgan from the team').click()
    const alert = page.getByRole('alertdialog')
    await expect(alert.getByText(/lose access on every device/)).toBeVisible()
    await expectToFitScreen(page)
    await alert.getByRole('button', { name: 'Remove from team' }).click()

    await expect(page.getByText('Alex Morgan is out of the team')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Alex Morgan from the team' })).toHaveCount(0)
    expect(called(calls, '/rest/v1/rpc/remove_team_member').map((call) => call.body)).toEqual([
      { team: TEAM.id, person: 'u-alex' },
    ])
  })

  test('a manager sees only who they can take out, and no permission switches', async ({ page }) => {
    await fakeSupabase(page, {
      member: true,
      access: { role: 'member', can_approve: false, is_manager: true },
      people: [
        ...PEOPLE,
        { user_id: 'u-kim', name: 'Kim Park', job_role: 'head_chef', role: 'member', can_approve: false, is_manager: true },
      ],
    })
    await page.goto(`${ACCOUNTS_URL}/settings/manage?tab=staff`)
    await expect(page.getByRole('heading', { name: 'People in the team' })).toBeVisible()
    await expect(button(page, 'Remove Alex Morgan from the team')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Kim Park from the team' })).toHaveCount(0)
    await expect(page.getByRole('switch', { name: /: Manager$/ })).toHaveCount(0)
  })

  test('someone taken out is told, and their device lets go of the team', async ({ page }) => {
    // Out of the team: no membership, and no access.
    await fakeSupabase(page, { member: false, access: null })
    await page.goto(`${ACCOUNTS_URL}/`)
    await expect(page.getByText(`You’re no longer in ${TEAM.name}`)).toBeVisible()
    await expect(page.getByText('Join your team')).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mise.account') ?? '{}').team)).toBeNull()
  })

  test('signing out everywhere ends every session, then this one', async ({ page }) => {
    const calls = await fakeSupabase(page, { member: true })
    await page.goto(`${ACCOUNTS_URL}/profile`)
    await button(page, 'Sign out everywhere').click()
    const alert = page.getByRole('alertdialog')
    await expect(alert.getByText(/Every phone, tablet and computer/)).toBeVisible()
    await alert.getByRole('button', { name: 'Sign out everywhere' }).click()

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(calls.some((call) => call.path === '/auth/v1/logout' && call.search.includes('scope=global'))).toBe(true)
  })

  test('changing your password signs your other devices out', async ({ page }) => {
    const user = { id: ME.userId, email: ME.email, aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: ME.name } }
    const calls = await fakeSupabase(page, {
      member: true,
      on: (route, path) => {
        if (path === '/auth/v1/token') {
          void json(route, { access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, user })
          return true
        }
        if (path === '/auth/v1/user') {
          void json(route, user)
          return true
        }
        if (path === '/auth/v1/logout') {
          void route.fulfill({ status: 204 })
          return true
        }
        return false
      },
    })
    await page.goto(`${ACCOUNTS_URL}/profile`)
    await page.getByLabel('Current password').fill('old-password-1')
    const fresh = page.locator('#profile-new-password')
    await fresh.fill('short')
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await fresh.fill('blue-pans-hum')
    await page.getByLabel('Type it again').fill('blue-pans-hum')
    await expect(page.getByLabel('Sign out my other devices')).toBeChecked()
    await button(page, 'Change password').click()

    await expect(page.getByText('Your other devices have been signed out.')).toBeVisible()
    expect(calls.some((call) => call.path === '/auth/v1/logout' && call.search.includes('scope=others'))).toBe(true)
  })
})

test.describe('signing in', () => {
  test('a new password needs 8 characters, and not one anyone would guess', async ({ page }) => {
    await fakeSupabase(page)
    await page.goto(`${ACCOUNTS_URL}/`)
    await button(page, 'Create an account').click()
    await page.getByLabel('Email').fill('new@example.com')
    const password = page.getByLabel('Password')
    const create = page.getByRole('button', { name: 'Create account' })

    await password.fill('pans1')
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(create).toBeDisabled()
    await password.fill('password1')
    await expect(page.getByText(/too easy to guess/)).toBeVisible()
    await expect(create).toBeDisabled()
    await password.fill('blue-pans-hum')
    await expect(create).toBeEnabled()
  })

  test('a sign-in link can be asked for instead of a password', async ({ page }) => {
    const calls = await fakeSupabase(page)
    await page.goto(`${ACCOUNTS_URL}/`)
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
    await button(page, 'Email me a sign-in link').click()
    await expect(page.getByLabel('Password')).toHaveCount(0)
    await expectToFitScreen(page)
    await page.getByLabel('Email').fill('sam@example.com')
    await button(page, 'Email me a link').click()

    await expect(page.getByText(/we’ve sent it a link that signs you in/)).toBeVisible()
    const [otp] = called(calls, '/auth/v1/otp')
    expect(otp.body).toMatchObject({ email: 'sam@example.com', create_user: false })
  })

  test('an address without an account gets the same answer', async ({ page }) => {
    await fakeSupabase(page, {
      on: (route, path) => {
        if (path !== '/auth/v1/otp') return false
        // What Supabase Auth answers when there's no account and none may be made.
        void json(route, { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' }, 422)
        return true
      },
    })
    await page.goto(`${ACCOUNTS_URL}/`)
    await button(page, 'Email me a sign-in link').click()
    await page.getByLabel('Email').fill('nobody@example.com')
    await button(page, 'Email me a link').click()
    await expect(page.getByText(/If there’s an account for nobody@example.com/)).toBeVisible()
  })
})

test.describe('a shared kitchen device', () => {
  test.skip(({ viewport }) => ![360, 1440].includes(viewport?.width ?? 0), 'Once on a phone and once on a desktop')

  test.beforeEach(async ({ page }) => {
    await withDemoRecords(page, openDemo)
    await fakeSupabase(page, { member: true })
    await signedIn(page, { team: TEAM })
  })

  async function setPin(page: Page, person: string, pin: string) {
    await button(page, `Set ${person}’s PIN`).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('New PIN').fill(pin)
    await dialog.getByLabel('Type it again').fill(pin)
    await dialog.getByRole('button', { name: 'Save PIN' }).click()
    await expect(dialog).toHaveCount(0)
  }

  /** The owner sets their own PIN and Lena's, then makes this a shared device. */
  async function setUp(page: Page) {
    await page.goto(`${ACCOUNTS_URL}/settings/device`)
    await expect(page.getByText('Set your own PIN first, below.')).toBeVisible()
    await setPin(page, ME.name, '2580')
    await setPin(page, 'Lena Ferreira', '1357')
    await page.getByRole('switch', { name: 'Use as a shared kitchen device' }).click()
    await expect(page.getByLabel('Lock after')).toBeVisible()
  }

  const lockScreen = (page: Page) => page.getByRole('dialog', { name: 'Who’s using this device?' })

  test('people unlock it with their PIN, and can then do what they can on their own phone', async ({ page }) => {
    await setUp(page)
    await button(page, 'Lock now').click()
    const lock = lockScreen(page)
    await expect(lock).toBeVisible()
    await expectToFitScreen(page)
    await expect(lock.getByRole('button', { name: /Tom Whitfield/ })).toBeDisabled()

    await lock.getByRole('button', { name: /Lena Ferreira/ }).click()
    await lock.getByLabel('Lena Ferreira’s PIN').fill('0000')
    await lock.getByRole('button', { name: 'Unlock' }).click()
    await expect(lock.getByText('That PIN isn’t right.')).toBeVisible()
    await lock.getByLabel('Lena Ferreira’s PIN').fill('1357')
    await lock.getByRole('button', { name: 'Unlock' }).click()
    await expect(lock).toHaveCount(0)

    await expect(button(page, /^Signed in as Lena Ferreira/)).toBeVisible()
    // Not a reload: that locks a shared device again, as tested below.
    await logSheet(page, 'Temperature')
    await chooseAppliance(page)
    await expect(page.getByRole('dialog').getByText(/Checked by Lena Ferreira/)).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Change', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(lockScreen(page)).toBeVisible()
  })

  test('it locks itself when nobody has used it for a while', async ({ page }) => {
    await page.clock.install()
    await setUp(page)
    await page.clock.fastForward('04:00')
    await expect(lockScreen(page)).toHaveCount(0)
    await page.clock.fastForward('01:30')
    await expect(lockScreen(page)).toBeVisible()
  })

  test('switching person from the menu asks for their PIN', async ({ page }) => {
    await setUp(page)
    await button(page, /Switch person/).click()
    await page.getByRole('button', { name: /^LF Lena Ferreira/ }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByLabel('Lena Ferreira’s PIN').fill('1357')
    await dialog.getByRole('button', { name: 'Switch' }).click()
    await expect(button(page, /^Signed in as Lena Ferreira/)).toBeVisible()
  })
})
