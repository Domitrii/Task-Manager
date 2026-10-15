import { expect, test, type Page, type Route } from '@playwright/test'
import { ACCOUNTS_URL, DEVICE_URL, openDemo, openTab } from './app.ts'
import { expectToFitScreen, watchForErrors } from './layout.ts'

/**
 * The screens that only exist with Supabase: signing in, choosing a team and
 * the team's own settings. Nothing real is behind the keys this copy of the
 * app has, so each test answers Supabase's requests itself.
 */

const TEAM = { id: '6f1c2a90-0000-4000-8000-000000000001', name: 'The Copper Larder' }
const ME = { userId: '6f1c2a90-0000-4000-8000-0000000000aa', email: 'sam@example.com', name: 'Sam Taylor' }

interface Answers {
  /** Someone already let in, or not yet. */
  member?: boolean
  /** Their request to join, if they've asked and are waiting. */
  pendingRequest?: boolean
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/** Stands in for the Supabase project: just enough for each screen to load. */
async function fakeSupabase(page: Page, answers: Answers = {}) {
  await page.route('http://127.0.0.1:54399/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const select = url.searchParams.get('select') ?? ''

    if (path === '/rest/v1/team_members' && select.includes('teams')) {
      return json(route, answers.member ? [{ job_role: 'head_chef', teams: TEAM }] : [])
    }
    if (path === '/rest/v1/team_members') return json(route, { role: 'owner', can_approve: true, is_manager: true })
    if (path === '/rest/v1/teams') return json(route, { join_code: 'K7M2QX9P' })
    if (path === '/rest/v1/rpc/my_join_request') {
      return json(
        route,
        answers.pendingRequest ? { team_id: TEAM.id, team_name: TEAM.name, job_role: 'chef', status: 'pending' } : null,
      )
    }
    if (path === '/rest/v1/rpc/team_join_requests') {
      return json(route, [{ user_id: 'u-joining', name: 'Jordan Lee', job_role: 'kitchen_porter', requested_at: new Date().toISOString() }])
    }
    if (path === '/rest/v1/rpc/team_people') {
      return json(route, [
        { user_id: ME.userId, name: ME.name, job_role: 'head_chef', role: 'owner', can_approve: true, is_manager: true },
        { user_id: 'u-alex', name: 'Alex Morgan', job_role: 'chef', role: 'member', can_approve: false, is_manager: false },
      ])
    }
    // A brand-new team: no records yet, and anything sent is accepted.
    if (path === '/rest/v1/records') return json(route, [], route.request().method() === 'GET' ? 200 : 201)
    return json(route, path.startsWith('/auth/') ? {} : [])
  })
}

/** Signed in on this device: the app's record of the account, and Supabase's session for it. */
async function signedIn(page: Page, account: { team: typeof TEAM | null; name?: string }) {
  const name = account.name ?? ME.name
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url')
  // Never checked against a real server, so it only has to look like a token.
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ME.userId, email: ME.email, role: 'authenticated', exp: expiresAt })}.test`
  const session = {
    access_token: token,
    refresh_token: 'test-refresh',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    user: { id: ME.userId, email: ME.email, aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: name } },
  }
  await page.addInitScript(
    ({ me, team, name, session }) => {
      localStorage.setItem('mise.account', JSON.stringify({ userId: me.userId, email: me.email, name, team }))
      // Where supabase-js keeps the session for a project at 127.0.0.1.
      localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
    },
    { me: ME, team: account.team, name, session },
  )
}

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
    ['team settings', '/settings', 'Team'],
    ['profile', '/profile', null],
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

// Keeps the two copies of the app from being confused in a failure message.
test('the device-only copy has no sign-in', async ({ page }) => {
  await page.goto(`${DEVICE_URL}/`)
  await expect(page.getByText('Explore with demo data')).toBeVisible()
})
