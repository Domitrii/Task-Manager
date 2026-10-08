import { createClient } from '@supabase/supabase-js'

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
export const supabase = url && key ? createClient(url, key) : null
