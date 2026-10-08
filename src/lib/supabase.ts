import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Links from Supabase emails arrive with the outcome in the address. Read here,
// before the client starts, because it takes the token out of the address and
// signs in before any screen is listening.
const linkParams = new URLSearchParams(window.location.hash.slice(1))

/** This page was opened from a password reset email, so the person needs to choose a new password. */
export const openedFromPasswordReset = linkParams.get('type') === 'recovery' && linkParams.has('access_token')

/** Why an email link didn't work (usually that it expired or was already used), or null. */
export const emailLinkError = linkParams.get('error_description')

// Shown once; a reload shouldn't bring it back.
if (emailLinkError) window.history.replaceState(null, '', window.location.pathname + window.location.search)

/**
 * The Supabase client, or `null` when the app is built without Supabase keys,
 * in which case everything stays on the device as it did before sync.
 *
 * Only the publishable key belongs here. It is safe in the browser because
 * row-level security limits each account to its own team's records.
 */
export const supabase = url && key ? createClient(url, key, { auth: { storageKey: sessionKey(url) } }) : null

/** Where the session is kept. Supabase's own default, named here so signing out can be sure it's gone. */
function sessionKey(projectUrl: string): string {
  return `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`
}

/**
 * Signs this device out. Supabase asks the server to end the session first and
 * keeps it if that request fails (a bad connection, a server error, a rate
 * limit), which would sign the device straight back in on the next reload or
 * token refresh. Signing out of a device has to work regardless, so the saved
 * session is removed here either way.
 */
export async function signOutThisDevice(client: SupabaseClient): Promise<void> {
  try {
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (!error) return
  } catch {
    // Treated the same as a failed request.
  }
  if (url) localStorage.removeItem(sessionKey(url))
}
