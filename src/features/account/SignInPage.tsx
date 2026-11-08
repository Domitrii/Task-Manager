import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { emailLinkError } from '@/lib/supabase'
import { authErrorMessage, MIN_PASSWORD, passwordProblem } from './sync'

const INPUT = 'h-12 text-base'
const LINK = 'text-brand-700 dark:text-brand-300 font-semibold hover:underline'

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'link'

/** Shown once Google is set up as a provider in Supabase. */
const GOOGLE = import.meta.env.VITE_GOOGLE_SIGN_IN === 'true'

/**
 * Supabase's answers for an address with no account, when a sign-in link is
 * asked for. The screen says the same as when one was sent, so nobody can use
 * it to find out who has an account.
 */
const NO_ACCOUNT = new Set(['otp_disabled', 'signup_disabled', 'user_not_found', 'email_address_not_authorized'])

const EMAIL_TAKEN = 'That email is already taken. Sign in instead, or use “Forgot password?” if you can’t remember it.'

/**
 * The first thing a device sees, once. It sits outside the router, so a QR
 * label scanned on a new phone signs in here and then carries on to the label.
 */
export function SignInPage({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // An expired confirmation or reset link lands here, with the reason.
  const [error, setError] = useState<string | null>(() =>
    emailLinkError ? `That link didn’t work: ${emailLinkError.toLowerCase()}. Sign in, or ask for a new one.` : null,
  )
  const [sent, setSent] = useState<{ to: string; kind: 'confirm' | 'reset' | 'link' } | null>(null)

  const signingUp = mode === 'sign-up'
  const forgot = mode === 'forgot'
  const byLink = mode === 'link'
  const weak = signingUp && password.length > 0 ? passwordProblem(password) : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const address = email.trim()

    if (forgot) {
      const { error: failure } = await client.auth.resetPasswordForEmail(address, {
        redirectTo: window.location.origin,
      })
      setBusy(false)
      if (failure) setError(authErrorMessage(failure))
      else setSent({ to: address, kind: 'reset' })
      return
    }

    if (byLink) {
      const { error: failure } = await client.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      })
      setBusy(false)
      if (failure && !NO_ACCOUNT.has(failure.code ?? '')) setError(authErrorMessage(failure))
      else setSent({ to: address, kind: 'link' })
      return
    }

    if (signingUp && passwordProblem(password)) {
      setBusy(false)
      return
    }

    const credentials = { email: address, password }
    const { data, error: failure } = signingUp
      ? await client.auth.signUp({
          ...credentials,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() || undefined } },
        })
      : await client.auth.signInWithPassword(credentials)
    setBusy(false)
    if (failure) setError(authErrorMessage(failure))
    // While email confirmation is on, Supabase doesn't say an address is taken:
    // it answers with a stand-in user that has no way to sign in.
    else if (signingUp && data.user?.identities?.length === 0) setError(EMAIL_TAKEN)
    // With a session the gate hears about it and moves on to the team; without one,
    // the new account's address needs confirming first.
    else if (!data.session) setSent({ to: address, kind: 'confirm' })
  }

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
  }

  if (sent) {
    return (
      <FocusFrame
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setSent(null)
              switchTo('sign-in')
            }}
            className="w-full sm:w-auto sm:min-w-44"
          >
            Back to sign in
          </Button>
        }
      >
        <FocusHeading
          title="Check your email"
          description={
            sent.kind === 'reset'
              ? `If there’s an account for ${sent.to}, we’ve sent it a link to choose a new password. Open it on this device. It works for a short while, and only once.`
              : sent.kind === 'link'
                ? `If there’s an account for ${sent.to}, we’ve sent it a link that signs you in. Open it on this device. It works for a short while, and only once.`
                : `We’ve sent a link to ${sent.to}. Open it to confirm the account, then sign in here.`
          }
        />
        <p className="text-ink-muted text-sm">Nothing there? Check your spam folder.</p>
      </FocusFrame>
    )
  }

  const submitLabel = forgot || byLink
    ? busy
      ? 'Sending…'
      : forgot
        ? 'Send reset link'
        : 'Email me a link'
    : signingUp
      ? busy
        ? 'Creating account…'
        : 'Create account'
      : busy
        ? 'Signing in…'
        : 'Sign in'

  return (
    <FocusFrame
      onSubmit={submit}
      actions={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !email.trim() || (!forgot && !byLink && !password) || weak !== null}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {submitLabel}
        </Button>
      }
    >
      <FocusHeading
        title={forgot ? 'Reset your password' : byLink ? 'Sign in with a link' : signingUp ? 'Create your account' : 'Sign in'}
        description={
          forgot
            ? 'Enter the email you sign in with, and we’ll send you a link to choose a new password.'
            : byLink
              ? 'No password needed: we’ll email you a link that signs you in on this device.'
            : signingUp
              ? 'Everyone has their own account. Next you’ll join your team with its code, or create a new team.'
              : 'Everyone in your team shares the same records, and keeps recording when the signal drops.'
        }
      />

      <div className="space-y-5">
        {GOOGLE && !forgot && !byLink ? (
          <>
            <Button
              size="lg"
              block
              disabled={busy}
              onClick={async () => {
                setError(null)
                const { error: failure } = await client.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: window.location.origin },
                })
                if (failure) setError(authErrorMessage(failure))
              }}
            >
              Continue with Google
            </Button>
            <p className="text-ink-subtle text-center text-xs">or with your email</p>
          </>
        ) : null}
        {signingUp ? (
          <Field label="Your name" hint="Optional. You can change it later in your profile." htmlFor="account-name">
            <TextInput
              id="account-name"
              autoComplete="name"
              className={INPUT}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        ) : null}
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
        {forgot || byLink ? null : (
          <div>
            <Field
              label="Password"
              htmlFor="account-password"
              hint={signingUp ? `At least ${MIN_PASSWORD} characters.` : undefined}
              error={weak ?? undefined}
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
            {signingUp ? null : (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                <button type="button" onClick={() => switchTo('forgot')} className={`${LINK} text-sm`}>
                  Forgot password?
                </button>
                <button type="button" onClick={() => switchTo('link')} className={`${LINK} text-sm`}>
                  Email me a sign-in link
                </button>
              </div>
            )}
          </div>
        )}
        {error ? (
          <p role="alert" className="text-fail-600 dark:text-fail-500 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <p className="text-ink-muted mt-8 text-sm">
        {forgot ? 'Remembered it?' : byLink ? 'Rather use your password?' : signingUp ? 'Already have an account?' : 'New to Mise?'}{' '}
        <button
          type="button"
          onClick={() => switchTo(signingUp || forgot || byLink ? 'sign-in' : 'sign-up')}
          className={LINK}
        >
          {signingUp || forgot || byLink ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </FocusFrame>
  )
}
