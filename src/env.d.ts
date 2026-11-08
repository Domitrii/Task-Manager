interface ImportMetaEnv {
  /** e.g. `https://abcd1234.supabase.co`. Without it (and the key) the app runs device-only. */
  readonly VITE_SUPABASE_URL?: string
  /** The project's publishable key (`sb_publishable_…`). Never the secret key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** `true` once Google is set up as a sign-in provider in Supabase; until then the button stays hidden. */
  readonly VITE_GOOGLE_SIGN_IN?: string
  /** The public half of the VAPID pair the `send-reminders` function signs with. Without it, reminders only pop up while Mise is open. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}
