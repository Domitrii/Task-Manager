import { createContext, use } from 'react'
import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import { CloudAlert, CloudCheck, CloudOff, CloudUpload, type LucideIcon } from 'lucide-react'
import type { SyncStatus } from '@/data/supabaseRepository'
import { formatAgo } from '@/lib/format'
import type { TeamDetails, TeamRef } from './team'

export interface SyncApi {
  /** The person signed in on this device. */
  email: string
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
}

export const SyncContext = createContext<SyncApi | null>(null)

/** Sync controls, or null when the app runs device-only because no Supabase keys are set. */
export function useSync(): SyncApi | null {
  return use(SyncContext)
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
      return 'Choose a longer password: at least 6 characters.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a minute and try again.'
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
