import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * The Supabase client, or `null` when the app is built without Supabase keys,
 * in which case everything stays on the device as it did before sync.
 *
 * Only the publishable key belongs here. It is safe in the browser because
 * row-level security limits each account to its own venue's records.
 */
export const supabase = url && key ? createClient(url, key) : null
