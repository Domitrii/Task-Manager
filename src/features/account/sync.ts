import { createContext, use } from 'react'
import { isAuthRetryableFetchError, type AuthError, type SupabaseClient, type User } from '@supabase/supabase-js'
import { CloudAlert, CloudCheck, CloudOff, CloudUpload, type LucideIcon } from 'lucide-react'
import type { SyncStatus } from '@/data/supabaseRepository'
import { formatAgo } from '@/lib/format'
import type { JoinRequest, TeamDetails, TeamPerson, TeamRef } from './team'

export interface SyncApi {
  /** The person signed in on this device. */
  email: string
  /** Their name from their profile; empty until they set one. */
  name: string
  team: TeamRef
  status: SyncStatus
  syncNow: () => void
  /** For when the session was lost. Resolves to an error message, or null once signed in. */
  signInAgain: (password: string) => Promise<string | null>
  /** Signs this device out and forgets its copy of the team's records, unsent ones included. */
  signOut: () => Promise<void>
  /** The code others join with, and whether this person may change it. Needs a connection. */
  teamDetails: () => Promise<TeamDetails>
  /** Replaces the join code, so the old one stops working. Owners only. */
  newJoinCode: () => Promise<string>
  /** Takes this account out of the team and back to choosing one. */
  leaveTeam: () => Promise<void>
  /** People asking to join. Only the owner and anyone they allow see them; empty for everyone else. */
  joinRequests: JoinRequest[]
  /** Looks for new requests now rather than at the next regular check. */
  refreshJoinRequests: () => void
  approveJoin: (userId: string) => Promise<void>
  declineJoin: (userId: string) => Promise<void>
  /** Everyone with an account in the team. Needs a connection. */
  teamPeople: () => Promise<TeamPerson[]>
  /** Lets someone approve new people, or stops them. Owners only. */
  setApprover: (userId: string, allowed: boolean) => Promise<void>
  /**
   * The owner, or someone they've made a manager: sees every reading and its
   * photo, and can change any reading at any time. As last known, so it holds offline.
   */
  isManager: boolean
  /** Makes someone a manager, or stops them being one. Owners only. */
  setManager: (userId: string, allowed: boolean) => Promise<void>
  /** The account signed in on this device. */
  userId: string
  /**
   * The accounts that are managers (the owner included), for a shared kitchen
   * device, where what someone may do follows whoever is at it. As last known.
   */
  managerIds: string[]
  /** Takes someone out of the team. Their records stay. The owner can take anyone; a manager, anyone who isn't one. */
  removeMember: (userId: string) => Promise<void>
  /** Signs this account out of every device, this one included. Needs a connection. */
  signOutEverywhere: () => Promise<void>
  /** Deletes this person's account for good; the team and its records stay. Needs a connection. */
  deleteAccount: () => Promise<void>
}

export const SyncContext = createContext<SyncApi | null>(null)

/** Sync controls, or null when the app runs device-only because no Supabase keys are set. */
export function useSync(): SyncApi | null {
  return use(SyncContext)
}

/** The name someone gave on their profile, kept with their Supabase account. */
export function profileName(user: User): string {
  const name: unknown = user.user_metadata?.full_name
  return typeof name === 'string' ? name : ''
}

/** Saves the name someone goes by. Resolves to an error message, or null once saved. */
export async function saveProfileName(client: SupabaseClient, name: string): Promise<string | null> {
  const { error } = await client.auth.updateUser({ data: { full_name: name.trim() } })
  return error ? authErrorMessage(error) : null
}

/** The shortest password Mise accepts. Set the same in Supabase (Authentication → Providers → Email). */
export const MIN_PASSWORD = 8

/** The passwords people reach for first, and the first guesses anyone would try. */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', '87654321', '11111111',
  'qwertyuiop', 'qwerty123', 'iloveyou', 'abcd1234', 'letmein1', 'welcome1', 'changeme', 'kitchen1',
  'restaurant', 'passw0rd', '00000000', 'football',
])

/** What's wrong with a new password, or null when it will do. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
    return 'That one is too easy to guess. Try a few words together.'
  }
  return null
}

export function authErrorMessage(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) return 'You’re offline. Signing in needs a connection.'
  switch (error.code) {
    case 'invalid_credentials':
      return 'That email and password don’t match an account.'
    case 'email_not_confirmed':
      return 'Confirm your email first. The link is in your inbox.'
    case 'user_already_exists':
    case 'email_exists':
      return 'That email is already taken. Sign in instead.'
    case 'same_password':
      return 'That’s the password you have now. Choose a different one.'
    case 'weak_password':
      return `Choose a longer password: at least ${MIN_PASSWORD} characters.`
    case 'email_address_invalid':
    case 'validation_failed':
      return 'That email address doesn’t look right.'
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return 'For security, sign out and back in, then try again.'
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a minute and try again.'
    // The project's limit on emails per hour, shared by everyone, not this person's attempts.
    case 'over_email_send_rate_limit':
      return 'Mise has sent too many emails in the last hour. Try again later.'
    default:
      return error.message
  }
}

export interface StatusView {
  icon: LucideIcon
  /** A word or two for the top bar. */
  label: string
  title: string
  detail: string
}

function records(count: number): string {
  return `${count} ${count === 1 ? 'record' : 'records'}`
}

/** What the sync state means for the person holding the device. */
export function describeStatus(status: SyncStatus): StatusView {
  const { pending } = status
  switch (status.state) {
    case 'offline':
      return {
        icon: CloudOff,
        label: 'Offline',
        title: pending > 0 ? `${records(pending)} saved on this device` : 'Offline',
        detail: 'Keep recording as normal. Everything syncs when the connection comes back.',
      }
    case 'signed-out':
      return {
        icon: CloudAlert,
        label: 'Not syncing',
        title: 'Signed out on this device',
        detail:
          pending > 0
            ? `${records(pending)} waiting to sync. Sign in again from Settings → Data to send them.`
            : 'Sign in again from Settings → Data to keep this device up to date.',
      }
    case 'error':
      return {
        icon: CloudAlert,
        label: 'Not syncing',
        title: 'Couldn’t sync',
        detail: `${status.error ?? 'The server turned the request down'}. Records are safe on this device, and it keeps trying.`,
      }
    default:
      // A background check for other devices' changes looks the same as being synced.
      if (pending > 0) {
        return {
          icon: CloudUpload,
          label: 'Syncing',
          title: `Sending ${records(pending)}`,
          detail: 'Carry on. Nothing needs you to wait for it.',
        }
      }
      return {
        icon: CloudCheck,
        label: 'Synced',
        title: 'Everything is synced',
        detail: status.lastSyncedAt ? `Last synced ${formatAgo(status.lastSyncedAt)}.` : 'Up to date.',
      }
  }
}
