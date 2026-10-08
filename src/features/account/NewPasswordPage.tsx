import { useState, type FormEvent } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { authErrorMessage } from './sync'

const INPUT = 'h-12 text-base'

/**
 * Where a password reset email lands. The link has already signed the person
 * in; once they've chosen a new password they carry on into their team.
 */
export function NewPasswordPage({
  client,
  onDone,
  onCancel,
}: {
  client: SupabaseClient
  onDone: (user: User) => void
  /** The link didn't work: back to signing in, to ask for another. */
  onCancel: () => void
}) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  const mismatch = repeat.length > 0 && repeat !== password

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || mismatch) return
    setBusy(true)
    setError(null)
    const { data, error: failure } = await client.auth.updateUser({ password })
    setBusy(false)
    if (failure) {
      // The link signs in for a short while only.
      if (failure.name === 'AuthSessionMissingError') setExpired(true)
      else setError(authErrorMessage(failure))
      return
    }
    toast.success('Password changed', 'Use the new one to sign in on your other devices.')
    onDone(data.user)
  }

  if (expired) {
    return (
      <FocusFrame
        actions={
          <Button variant="primary" size="lg" onClick={onCancel} className="w-full sm:w-auto sm:min-w-44">
            Back to sign in
          </Button>
        }
      >
        <FocusHeading
          title="This link has expired"
          description="Reset links only work for a short while, and only once. Choose “Forgot password?” to get a new one."
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
          disabled={busy || !password || password !== repeat}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {busy ? 'Saving…' : 'Save password'}
        </Button>
      }
    >
      <FocusHeading title="Choose a new password" description="You’ll use it to sign in on every device." />
      <div className="space-y-5">
        <Field label="New password" htmlFor="new-password" hint="At least 6 characters.">
          <TextInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            className={INPUT}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field
          label="Type it again"
          htmlFor="repeat-password"
          error={mismatch ? 'The two passwords don’t match.' : undefined}
        >
          <TextInput
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            className={INPUT}
            value={repeat}
            invalid={mismatch}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-fail-600 dark:text-fail-500 text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </FocusFrame>
  )
}
