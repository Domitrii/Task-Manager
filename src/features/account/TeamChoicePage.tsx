import { useEffect, useEffectEvent, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, Check, KeyRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { Choice } from '@/components/shared/Choice'
import { jobRoleLabel, STAFF_ROLE_LABELS, STAFF_ROLES } from '@/data/staffRoles'
import type { StaffRole } from '@/data/types'
import { cn } from '@/lib/utils'
import { saveProfileName } from './sync'
import {
  cancelJoinRequest,
  createTeam,
  findMyJoinRequest,
  findMyTeam,
  findTeam,
  requestToJoin,
  teamErrorMessage,
  type Membership,
  type MyJoinRequest,
  type TeamRef,
} from './team'

const INPUT = 'h-12 text-base'
const ROLE_OPTIONS: StaffRole[] = [...STAFF_ROLES, 'other']
/** How often the waiting screen asks whether they've been let in. */
const CHECK_EVERY = 10_000

type Step = 'checking' | 'offline' | 'choose' | 'join' | 'role' | 'create' | 'waiting' | 'declined'

/** Where an account stands: in a team, or not yet, with or without a request to join one. */
type Standing = { membership: Membership } | { request: MyJoinRequest | null }

async function lookUp(client: SupabaseClient, userId: string): Promise<Standing> {
  const membership = await findMyTeam(client, userId)
  if (membership) return { membership }
  return { request: await findMyJoinRequest(client) }
}

/**
 * After signing in, before the app: an account that's already in a team goes
 * straight through. One that isn't either creates a team, or asks to join one
 * with its code, says what they do there, and waits for the owner (or someone
 * the owner allows) to let them in. Either way they say who they are, since
 * the team's records are signed with it.
 */
export function TeamChoicePage({
  client,
  userId,
  email,
  name: savedName,
  onTeam,
  onSignOut,
}: {
  client: SupabaseClient
  userId: string
  email: string
  /** From their profile; empty if they haven't given one. */
  name: string
  /** `name` is set when they gave a new one on the way in; `jobRole` is what they were let in as. */
  onTeam: (team: TeamRef, joined: { name?: string; jobRole?: string | null }) => void
  onSignOut: () => Promise<void>
}) {
  const [step, setStep] = useState<Step>('checking')
  const [attempt, setAttempt] = useState(0)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [yourName, setYourName] = useState(savedName)
  /** A name they saved on the way in, which the account doesn't know about yet. */
  const [newName, setNewName] = useState<string | undefined>(undefined)
  /** The team their code belongs to, while they say what they do there. */
  const [team, setTeam] = useState<TeamRef | null>(null)
  const [role, setRole] = useState<StaffRole | null>(null)
  const [otherRole, setOtherRole] = useState('')
  const [request, setRequest] = useState<MyJoinRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  function settle(standing: Standing) {
    if ('membership' in standing) {
      onTeam(standing.membership.team, { name: newName, jobRole: standing.membership.jobRole })
      return
    }
    setRequest(standing.request)
    setStep(standing.request ? (standing.request.status === 'pending' ? 'waiting' : 'declined') : 'choose')
  }
  const arrive = useEffectEvent(settle)

  useEffect(() => {
    let live = true
    lookUp(client, userId).then(
      (standing) => live && arrive(standing),
      () => live && setStep('offline'),
    )
    return () => {
      live = false
    }
  }, [client, userId, attempt])

  // While they wait, keep asking, so they go in as soon as someone lets them.
  useEffect(() => {
    if (step !== 'waiting') return
    let live = true
    const check = () => {
      if (document.visibilityState !== 'visible') return
      lookUp(client, userId).then(
        (standing) => live && arrive(standing),
        () => {
          // Offline: ask again at the next check.
        },
      )
    }
    const timer = window.setInterval(check, CHECK_EVERY)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [client, userId, step])

  function go(next: Step) {
    setStep(next)
    setError(null)
    setNameError(null)
  }

  const askedRole = role === 'other' ? otherRole.trim() : (role ?? '')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNameError(null)
    try {
      if (step === 'role') {
        const joining = await requestToJoin(client, code, askedRole)
        setRequest({ team: joining, jobRole: askedRole, status: 'pending' })
        go('waiting')
        return
      }
      const person = yourName.trim()
      if (person !== (newName ?? savedName.trim())) {
        const failure = await saveProfileName(client, person)
        if (failure) {
          setNameError(failure)
          return
        }
        setNewName(person)
      }
      if (step === 'join') {
        setTeam(await findTeam(client, code))
        go('role')
      } else {
        onTeam(await createTeam(client, name), { name: person !== savedName.trim() ? person : undefined })
      }
    } catch (failure) {
      setError(teamErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function checkNow() {
    setBusy(true)
    setError(null)
    try {
      settle(await lookUp(client, userId))
    } catch (failure) {
      setError(teamErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function cancelRequest() {
    setBusy(true)
    setError(null)
    try {
      await cancelJoinRequest(client)
      setRequest(null)
      go('choose')
    } catch (failure) {
      setError(teamErrorMessage(failure))
    } finally {
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

  const errorLine = error ? (
    <p role="alert" className="text-fail-600 dark:text-fail-500 mt-4 text-sm">
      {error}
    </p>
  ) : null

  const back = (to: Step) => (
    <button
      type="button"
      onClick={() => go(to)}
      className="text-ink-muted hover:text-ink -ml-1 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold"
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
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
            description="Enter the code someone in your team gave you, then wait for them to let you in."
            onClick={() => go('join')}
          />
          <Choice
            icon={Users}
            title="Create a team"
            description="For a new venue. You’ll get a code to share, and you decide who gets in."
            onClick={() => go('create')}
          />
        </div>
        {signedInAs}
      </FocusFrame>
    )
  }

  if (step === 'waiting' && request) {
    return (
      <FocusFrame
        actions={
          <>
            <Button variant="ghost" size="lg" disabled={busy} onClick={() => void cancelRequest()}>
              Cancel request
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => void checkNow()}
              className="w-full sm:w-auto sm:min-w-44"
            >
              {busy ? 'Checking…' : 'Check now'}
            </Button>
          </>
        }
      >
        <FocusHeading
          title="Waiting for approval"
          description={`You’ve asked to join ${request.team.name} as ${jobRoleLabel(request.jobRole)}. The owner, or someone they’ve allowed, needs to let you in.`}
        />
        <p className="text-ink-muted text-[15px]">
          This screen moves on by itself once they do. You can close the app in the meantime: you’ll go straight in
          next time you open it.
        </p>
        {errorLine}
        {signedInAs}
      </FocusFrame>
    )
  }

  if (step === 'declined' && request) {
    return (
      <FocusFrame
        actions={
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={() => void cancelRequest()}
            className="w-full sm:w-auto sm:min-w-44"
          >
            OK
          </Button>
        }
      >
        <FocusHeading
          title="Your request was declined"
          description={`${request.team.name} didn’t approve your request to join. If you think that’s a mistake, ask whoever gave you the code, then try again.`}
        />
        {errorLine}
        {signedInAs}
      </FocusFrame>
    )
  }

  if (step === 'role' && team) {
    return (
      <FocusFrame
        onSubmit={submit}
        top={back('join')}
        actions={
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={busy || !askedRole}
            className="w-full sm:w-auto sm:min-w-44"
          >
            {busy ? 'Sending…' : 'Ask to join'}
          </Button>
        }
      >
        <FocusHeading
          title={`What do you do at ${team.name}?`}
          description="Whoever lets you in sees this, and it’s how you’ll show on the team list."
        />
        <fieldset>
          <legend className="sr-only">Your role</legend>
          <div className="space-y-2">
            {ROLE_OPTIONS.map((option) => {
              const checked = role === option
              return (
                <label
                  key={option}
                  className={cn(
                    'flex h-13 cursor-pointer items-center gap-3 rounded-xl border px-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                    checked
                      ? 'border-brand-600 bg-brand-50 ring-brand-600 dark:bg-brand-950 ring-1'
                      : 'bg-surface border-line-default hover:border-line-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="join-role"
                    value={option}
                    checked={checked}
                    onChange={() => setRole(option)}
                    className="sr-only"
                  />
                  <span className="text-ink flex-1 text-base font-semibold">{STAFF_ROLE_LABELS[option]}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong',
                    )}
                  >
                    {checked ? <Check className="size-3 text-white" strokeWidth={3.5} /> : null}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {role === 'other' ? (
          <Field label="Your role" htmlFor="join-other-role" className="mt-4">
            <TextInput
              id="join-other-role"
              autoFocus
              maxLength={60}
              placeholder="e.g. Sous chef"
              className={INPUT}
              value={otherRole}
              onChange={(event) => setOtherRole(event.target.value)}
            />
          </Field>
        ) : null}
        {errorLine}
      </FocusFrame>
    )
  }

  const joining = step === 'join'

  return (
    <FocusFrame
      onSubmit={submit}
      top={back('choose')}
      actions={
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !yourName.trim() || !(joining ? code.trim() : name.trim())}
          className="w-full sm:w-auto sm:min-w-44"
        >
          {joining ? (busy ? 'Checking…' : 'Continue') : busy ? 'Creating…' : 'Create team'}
        </Button>
      }
    >
      <FocusHeading
        title={joining ? 'Enter your team code' : 'Name your team'}
        description={
          joining
            ? 'It’s 8 letters and numbers, like ABCD-2345. Anyone in the team can find it in Settings → Team.'
            : 'Usually the venue’s name. Once it’s created, share the code from Settings → Team, and approve people there as they ask to join.'
        }
      />
      <div className="space-y-5">
        <Field
          label="Your name"
          required
          hint="Your team sees it on everything you record."
          htmlFor="team-your-name"
          error={nameError ?? undefined}
        >
          <TextInput
            id="team-your-name"
            autoFocus={!savedName.trim()}
            autoComplete="name"
            maxLength={80}
            placeholder="e.g. Sam Patel"
            className={INPUT}
            value={yourName}
            invalid={Boolean(nameError)}
            onChange={(event) => setYourName(event.target.value)}
          />
        </Field>
        {joining ? (
          <Field label="Team code" htmlFor="team-code" error={error ?? undefined}>
            <TextInput
              id="team-code"
              autoFocus={Boolean(savedName.trim())}
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
              autoFocus={Boolean(savedName.trim())}
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
      </div>
    </FocusFrame>
  )
}
