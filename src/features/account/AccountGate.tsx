import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataRepository } from '@/data/repository'
import { SupabaseRepository } from '@/data/supabaseRepository'
import { SignInPage } from './SignInPage'
import { authErrorMessage, SyncContext, type SyncApi } from './sync'

interface Venue {
  /** The account's user id, which is also the venue id its records are stored under. */
  id: string
  email: string
}

const VENUE_KEY = 'mise.venue'

function readVenue(): Venue | null {
  try {
    const stored = JSON.parse(localStorage.getItem(VENUE_KEY) ?? 'null') as Venue | null
    return stored?.id ? stored : null
  } catch {
    return null
  }
}

/**
 * With Supabase configured, a venue is an account. A device signs in once;
 * from then on it remembers which venue it belongs to and opens straight into
 * it, with or without a connection, until someone signs it out.
 */
export function AccountGate({
  client,
  legacy,
  children,
}: {
  client: SupabaseClient
  /** Records this device kept before sync, offered to a venue that has none yet. */
  legacy: DataRepository
  children: (repository: DataRepository) => ReactNode
}) {
  const [venue, setVenue] = useState<Venue | null>(readVenue)

  // Signing in (or following an email confirmation link) opens that account's venue.
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!session || readVenue()) return
      const next: Venue = { id: session.user.id, email: session.user.email ?? '' }
      localStorage.setItem(VENUE_KEY, JSON.stringify(next))
      setVenue(next)
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const signedOut = useCallback(() => {
    localStorage.removeItem(VENUE_KEY)
    setVenue(null)
  }, [])

  if (!venue) return <SignInPage client={client} />

  return (
    <VenueSession key={venue.id} client={client} venue={venue} legacy={legacy} onSignedOut={signedOut}>
      {children}
    </VenueSession>
  )
}

function VenueSession({
  client,
  venue,
  legacy,
  onSignedOut,
  children,
}: {
  client: SupabaseClient
  venue: Venue
  legacy: DataRepository
  onSignedOut: () => void
  children: (repository: DataRepository) => ReactNode
}) {
  const [repository] = useState(() => new SupabaseRepository(client, venue.id, legacy))

  useEffect(() => {
    repository.start()
    return () => repository.stop()
  }, [repository])

  const status = useSyncExternalStore(repository.subscribeStatus, repository.getStatus)

  const api = useMemo<SyncApi>(
    () => ({
      email: venue.email,
      status,
      syncNow: () => repository.syncNow(),
      async signInAgain(password) {
        const { error } = await client.auth.signInWithPassword({ email: venue.email, password })
        return error ? authErrorMessage(error) : null
      },
      async signOut() {
        await repository.clearLocal()
        // This device only: the venue's other devices stay signed in.
        await client.auth.signOut({ scope: 'local' })
        onSignedOut()
      },
    }),
    [client, repository, venue.email, status, onSignedOut],
  )

  // Status changes every sync; the app itself only needs rendering once.
  const app = useMemo(() => children(repository), [children, repository])

  return <SyncContext value={api}>{app}</SyncContext>
}
