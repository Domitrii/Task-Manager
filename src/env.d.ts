interface ImportMetaEnv {
  /** e.g. `https://abcd1234.supabase.co`. Without it (and the key) the app runs device-only. */
  readonly VITE_SUPABASE_URL?: string
  /** The project's publishable key (`sb_publishable_…`). Never the secret key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
