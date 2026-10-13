import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { saveProfileName } from './sync'

/**
 * For an account that's in a team but never said who it is, e.g. one made
 * before names were asked for. The team's records are signed with the name,
 * so it's needed before the app.
 */
export function YourNamePage({
  client,
  email,
  onSaved,
  onSignOut,
}: {
  client: SupabaseClient
  email: string
  onSaved: (name: string) => void
  onSignOut: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    const failure = await saveProfileName(client, name)
    if (failure) {
      setError(failure)
      setBusy(false)
    } else onSaved(name.trim())
  }

  return (
    <FocusFrame
      onSubmit={submit}
      actions={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !name.trim()}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {busy ? 'Saving…' : 'Continue'}
        </Button>
      }
    >
      <FocusHeading
        title="What’s your name?"
        description="Your team sees it on everything you record. If you’re already on the team’s staff list, use the same name."
      />
      <Field label="Your name" htmlFor="your-name" error={error ?? undefined}>
        <TextInput
          id="your-name"
          autoFocus
          autoComplete="name"
          maxLength={80}
          placeholder="e.g. Sam Patel"
          className="h-12 text-base"
          value={name}
          invalid={Boolean(error)}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <p className="text-ink-subtle mt-8 text-center text-xs">
        Signed in as {email}.{' '}
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="text-brand-700 dark:text-brand-300 font-semibold hover:underline"
        >
          Sign out
        </button>
      </p>
    </FocusFrame>
  )
}
