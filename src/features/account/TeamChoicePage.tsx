import { useEffect, useEffectEvent, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, KeyRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { Choice } from '@/components/shared/Choice'
import { createTeam, findMyTeam, joinTeam, teamErrorMessage, type TeamRef } from './team'

const INPUT = 'h-12 text-base'

type Step = 'checking' | 'offline' | 'choose' | 'join' | 'create'

/**
 * After signing in, before the app: an account that's already in a team goes
 * straight through; one that isn't joins a team with its code, or creates one.
 */
export function TeamChoicePage({
  client,
  userId,
  email,
  onTeam,
  onSignOut,
}: {
  client: SupabaseClient
  userId: string
  email: string
  onTeam: (team: TeamRef) => void
  onSignOut: () => Promise<void>
}) {
  const [step, setStep] = useState<Step>('checking')
  const [attempt, setAttempt] = useState(0)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const found = useEffectEvent((team: TeamRef | null) => {
    if (team) onTeam(team)
    else setStep('choose')
  })

  useEffect(() => {
    let live = true
    findMyTeam(client, userId).then(
      (team) => live && found(team),
      () => live && setStep('offline'),
    )
    return () => {
      live = false
    }
  }, [client, userId, attempt])

  function go(next: Step) {
    setStep(next)
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      onTeam(step === 'join' ? await joinTeam(client, code) : await createTeam(client, name))
    } catch (failure) {
      setError(teamErrorMessage(failure))
      setBusy(false)
    }
  }

  const signedInAs = (
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
  )

  if (step === 'checking') {
    return (
      <FocusFrame>
        <FocusHeading title="Finding your team…" />
      </FocusFrame>
    )
  }

  if (step === 'offline') {
    return (
      <FocusFrame
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setStep('checking')
              setAttempt((count) => count + 1)
            }}
            className="w-full sm:w-auto sm:min-w-44"
          >
            Try again
          </Button>
        }
      >
        <FocusHeading
          title="You’re offline"
          description="This device needs a connection once to find your team. After that it works offline."
        />
        {signedInAs}
      </FocusFrame>
    )
  }

  if (step === 'choose') {
    return (
      <FocusFrame>
        <FocusHeading
          title="Join your team"
          description="Everyone in a team shares the same records: temperatures, checklists, deliveries and tasks."
        />
        <div className="space-y-3">
          <Choice
            primary
            icon={KeyRound}
            title="Join a team"
            description="Enter the code someone in your team gave you. They can find it in Settings → Team."
            onClick={() => go('join')}
          />
          <Choice
            icon={Users}
            title="Create a team"
            description="For a new venue. You’ll get a code to share with everyone who works there."
            onClick={() => go('create')}
          />
        </div>
        {signedInAs}
      </FocusFrame>
    )
  }

  const joining = step === 'join'

  return (
    <FocusFrame
      onSubmit={submit}
      top={
        <button
          type="button"
          onClick={() => go('choose')}
          className="text-ink-muted hover:text-ink -ml-1 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      }
      actions={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !(joining ? code.trim() : name.trim())}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {joining ? (busy ? 'Joining…' : 'Join team') : busy ? 'Creating…' : 'Create team'}
        </Button>
      }
    >
      <FocusHeading
        title={joining ? 'Enter your team code' : 'Name your team'}
        description={
          joining
            ? 'It’s 8 letters and numbers, like ABCD-2345. Anyone in the team can find it in Settings → Team.'
            : 'Usually the venue’s name. Once it’s created, share the code from Settings → Team so others can join.'
        }
      />
      {joining ? (
        <Field label="Team code" htmlFor="team-code" error={error ?? undefined}>
          <TextInput
            id="team-code"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            placeholder="ABCD-2345"
            className={`${INPUT} font-mono tracking-widest uppercase`}
            value={code}
            invalid={Boolean(error)}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
      ) : (
        <Field label="Team name" htmlFor="team-name" error={error ?? undefined}>
          <TextInput
            id="team-name"
            autoFocus
            autoComplete="organization"
            maxLength={80}
            placeholder="e.g. The Fox & Hound"
            className={INPUT}
            value={name}
            invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      )}
    </FocusFrame>
  )
}
