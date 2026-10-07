import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { authErrorMessage } from './sync'

const INPUT = 'h-12 text-base'

/**
 * The first thing a device sees, once. It sits outside the router, so a QR
 * label scanned on a new phone signs in here and then carries on to the label.
 */
export function SignInPage({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const signingUp = mode === 'sign-up'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const credentials = { email: email.trim(), password }
    const { data, error: failure } = signingUp
      ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } })
      : await client.auth.signInWithPassword(credentials)
    setBusy(false)
    if (failure) setError(authErrorMessage(failure))
    // With a session the gate hears about it and opens the venue; without one,
    // the new account's address needs confirming first.
    else if (!data.session) setSentTo(credentials.email)
  }

  function switchMode() {
    setMode(signingUp ? 'sign-in' : 'sign-up')
    setError(null)
  }

  if (sentTo) {
    return (
      <FocusFrame
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setSentTo(null)
              setMode('sign-in')
            }}
            className="w-full sm:w-auto sm:min-w-44"
          >
            Back to sign in
          </Button>
        }
      >
        <FocusHeading
          title="Check your email"
          description={`We’ve sent a link to ${sentTo}. Open it to confirm the account, then sign in here.`}
        />
      </FocusFrame>
    )
  }

  return (
    <FocusFrame
      onSubmit={submit}
      actions={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !email.trim() || !password}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {signingUp ? (busy ? 'Creating account…' : 'Create account') : busy ? 'Signing in…' : 'Sign in'}
        </Button>
      }
    >
      <FocusHeading
        title={signingUp ? 'Create your venue’s account' : 'Sign in to your venue'}
        description={
          signingUp
            ? 'One account per venue, shared by its devices. Use an address the team can rely on, like the venue’s own. Staff still pick their own name on each device.'
            : 'Every device signed in to your venue shares the same records, and keeps recording when the signal drops.'
        }
      />

      <div className="space-y-5">
        <Field label="Email" htmlFor="account-email">
          <TextInput
            id="account-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className={INPUT}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="account-password"
          hint={signingUp ? 'At least 6 characters.' : undefined}
        >
          <TextInput
            id="account-password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            className={INPUT}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-fail-600 dark:text-fail-500 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <p className="text-ink-muted mt-8 text-sm">
        {signingUp ? 'Already have an account?' : 'New to Mise?'}{' '}
        <button
          type="button"
          onClick={switchMode}
          className="text-brand-700 dark:text-brand-300 font-semibold hover:underline"
        >
          {signingUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </FocusFrame>
  )
}
