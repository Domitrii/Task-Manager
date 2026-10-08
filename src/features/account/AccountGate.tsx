import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { DataRepository, LocalStorageRepository } from '@/data/repository'
import { SupabaseRepository } from '@/data/supabaseRepository'
import { openedFromPasswordReset, signOutThisDevice } from '@/lib/supabase'
import { NewPasswordPage } from './NewPasswordPage'
import { SignInPage } from './SignInPage'
import { authErrorMessage, SyncContext, type SyncApi } from './sync'
import { fetchTeamDetails, leaveTeam, regenerateJoinCode, type TeamRef } from './team'
import { TeamChoicePage } from './TeamChoicePage'

interface Account {
  userId: string
  email: string
  /** Null until this account has joined or created a team. */
  team: TeamRef | null
}

const ACCOUNT_KEY = 'mise.account'
/** Before teams, a device remembered only the venue's shared account. */
const LEGACY_KEY = 'mise.venue'

function readAccount(): Account | null {
  try {
    const stored = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as Account | null
    if (stored?.userId) return stored
    // That account's records now belong to a team; it's looked up again once online.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as { id?: string; email?: string } | null
    return legacy?.id ? { userId: legacy.id, email: legacy.email ?? '', team: null } : null
  } catch {
    return null
  }
}

function writeAccount(account: Account | null) {
  localStorage.removeItem(LEGACY_KEY)
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  else localStorage.removeItem(ACCOUNT_KEY)
}

/**
 * With Supabase configured, everyone signs in with their own account and
 * belongs to a team, which owns the records. A device signs in once, then
 * joins or creates a team; from then on it remembers both and opens straight
 * into the team, with or without a connection, until someone signs it out.
 */
export function AccountGate({
  client,
  legacy,
  children,
}: {
  client: SupabaseClient
  /** Records this device kept before sync, offered to the first team it opens if that team has none. */
  legacy: LocalStorageRepository
  children: (repository: DataRepository) => ReactNode
}) {
  const [account, setAccount] = useState<Account | null>(readAccount)
  // A password reset link has signed the person in; they choose a new password before anything else.
  const [resetting, setResetting] = useState(openedFromPasswordReset)

  const update = useCallback((next: Account | null) => {
    writeAccount(next)
    setAccount(next)
  }, [])

  // Signing in (or following an email confirmation link) moves on to the team.
  // So does someone else signing in from another tab: the device follows
  // whoever is actually signed in, never the account it remembered. Anything
  // unsent stays queued under its team for when that account signs in again.
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setResetting(true)
      if (!session || readAccount()?.userId === session.user.id) return
      update({ userId: session.user.id, email: session.user.email ?? '', team: null })
    })
    return () => data.subscription.unsubscribe()
  }, [client, update])

  const signOut = useCallback(async () => {
    // This device only: the account's other devices stay signed in.
    await signOutThisDevice(client)
    update(null)
  }, [client, update])

  const leftTeam = useCallback(() => {
    const current = readAccount()
    if (current) update({ ...current, team: null })
  }, [update])

  const passwordChanged = useCallback(
    (user: User) => {
      setResetting(false)
      // The reset may be for someone other than whoever last used this device.
      if (readAccount()?.userId !== user.id) update({ userId: user.id, email: user.email ?? '', team: null })
    },
    [update],
  )

  if (resetting) {
    return <NewPasswordPage client={client} onDone={passwordChanged} onCancel={() => setResetting(false)} />
  }

  if (!account) return <SignInPage client={client} />

  if (!account.team) {
    return (
      <TeamChoicePage
        client={client}
        userId={account.userId}
        email={account.email}
        onTeam={(team) => update({ ...account, team })}
        onSignOut={signOut}
      />
    )
  }

  return (
    <TeamSession
      key={`${account.userId}/${account.team.id}`}
      client={client}
      account={account as Account & { team: TeamRef }}
      legacy={legacy}
      onSignOut={signOut}
      onLeft={leftTeam}
    >
      {children}
    </TeamSession>
  )
}

function TeamSession({
  client,
  account,
  legacy,
  onSignOut,
  onLeft,
  children,
}: {
  client: SupabaseClient
  account: Account & { team: TeamRef }
  legacy: LocalStorageRepository
  onSignOut: () => Promise<void>
  onLeft: () => void
  children: (repository: DataRepository) => ReactNode
}) {
  const { userId, email, team } = account
  const [repository] = useState(() => new SupabaseRepository(client, team.id, userId, legacy))

  useEffect(() => {
    repository.start()
    return () => repository.stop()
  }, [repository])

  const status = useSyncExternalStore(repository.subscribeStatus, repository.getStatus)

  // Kept apart from the status, which changes every sync, so these stay the same functions.
  const actions = useMemo<Omit<SyncApi, 'status'>>(
    () => ({
      email,
      team,
      syncNow: () => repository.syncNow(),
      async signInAgain(password) {
        const { error } = await client.auth.signInWithPassword({ email, password })
        return error ? authErrorMessage(error) : null
      },
      async signOut() {
        await repository.clearLocal()
        await onSignOut()
      },
      teamDetails: () => fetchTeamDetails(client, team, userId),
      newJoinCode: () => regenerateJoinCode(client, team),
      async leaveTeam() {
        await leaveTeam(client)
        await repository.clearLocal()
        onLeft()
      },
    }),
    [client, repository, userId, email, team, onSignOut, onLeft],
  )
  const api = useMemo<SyncApi>(() => ({ ...actions, status }), [actions, status])

  // Status changes every sync; the app itself only needs rendering once.
  const app = useMemo(() => children(repository), [children, repository])

  return <SyncContext value={api}>{app}</SyncContext>
}
