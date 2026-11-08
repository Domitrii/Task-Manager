import type { Page, Route } from '@playwright/test'

/**
 * Stands in for the Supabase project, for the copy of the app with keys that
 * point at nothing (see `playwright.config.ts`). Just enough for each screen to
 * load; a test can answer anything else itself with `on`, and look at what was
 * sent in `calls`.
 */

export const TEAM = { id: '6f1c2a90-0000-4000-8000-000000000001', name: 'The Copper Larder' }
export const ME = { userId: '6f1c2a90-0000-4000-8000-0000000000aa', email: 'sam@example.com', name: 'Sam Taylor' }

export interface Answers {
  /** Someone already let in, or not yet. */
  member?: boolean
  /** Their request to join, if they've asked and are waiting. */
  pendingRequest?: boolean
  /** What this account may do in the team; null once it has been taken out. */
  access?: { role: 'owner' | 'member'; can_approve: boolean; is_manager: boolean } | null
  /** Everyone in the team, as `team_people` lists them. */
  people?: Array<{ user_id: string; name: string; job_role: string | null; role: string; can_approve: boolean; is_manager: boolean }>
  /** Answers a request first. Return true when it has. */
  on?: (route: Route, path: string) => Promise<boolean> | boolean
}

export interface Call {
  method: string
  path: string
  search: string
  body: unknown
}

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

export const OWNER_ACCESS = { role: 'owner', can_approve: true, is_manager: true } as const

export const PEOPLE: NonNullable<Answers['people']> = [
  { user_id: ME.userId, name: ME.name, job_role: 'head_chef', role: 'owner', can_approve: true, is_manager: true },
  { user_id: 'u-alex', name: 'Alex Morgan', job_role: 'chef', role: 'member', can_approve: false, is_manager: false },
]

export async function fakeSupabase(page: Page, answers: Answers = {}): Promise<Call[]> {
  const calls: Call[] = []
  await page.route('http://127.0.0.1:54399/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const select = url.searchParams.get('select') ?? ''
    let body: unknown = null
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }
    calls.push({ method: request.method(), path, search: url.search, body })

    if (answers.on && (await answers.on(route, path))) return
    if (path === '/rest/v1/team_members' && select.includes('teams')) {
      return json(route, answers.member ? [{ job_role: 'head_chef', teams: TEAM }] : [])
    }
    if (path === '/rest/v1/team_members') {
      const access = answers.access === undefined ? OWNER_ACCESS : answers.access
      return json(route, access === null ? [] : access)
    }
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
    if (path === '/rest/v1/rpc/team_people') return json(route, answers.people ?? PEOPLE)
    // A brand-new team: no records yet, and anything sent is accepted.
    if (path === '/rest/v1/records') return json(route, [], request.method() === 'GET' ? 200 : 201)
    return json(route, path.startsWith('/auth/') ? {} : [])
  })
  return calls
}

/** Signed in on this device: the app's record of the account, and Supabase's session for it. */
export async function signedIn(page: Page, account: { team: typeof TEAM | null; name?: string }) {
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

/** The demo venue, kept on this device from before it synced, becomes the team's records. */
export async function withDemoRecords(page: Page, openDemo: (page: Page) => Promise<void>) {
  await openDemo(page)
  const records = await page.evaluate(() => localStorage.getItem('mise.appdata.v1'))
  await page.goto('about:blank')
  await page.addInitScript((saved) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('mise.appdata.v1', saved ?? '')
      sessionStorage.setItem('seeded', 'yes')
    }
  }, records)
}
