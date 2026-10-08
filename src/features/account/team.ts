/**
 * Teams on the server: see `supabase/migrations/20261008000000_teams.sql`.
 * Each person has their own account and belongs to one team, which owns the
 * records. Creating, joining and leaving go through database functions, which
 * check the code and who is asking.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TeamRef {
  id: string
  name: string
}

export interface TeamDetails {
  code: string
  /** Owners can replace the code; everyone in the team can see and share it. */
  role: 'owner' | 'member'
}

interface TeamRow {
  id: string
  name: string
  join_code: string
}

/** The team this account is in, or null if it hasn't joined one. Throws when offline. */
export async function findMyTeam(client: SupabaseClient, userId: string): Promise<TeamRef | null> {
  const { data, error } = await client
    .from('team_members')
    .select('teams (id, name)')
    .eq('user_id', userId)
    .maybeSingle<{ teams: TeamRef | null }>()
  if (error) throw error
  return data?.teams ?? null
}

export async function createTeam(client: SupabaseClient, name: string): Promise<TeamRef> {
  const { data, error } = await client.rpc('create_team', { team_name: name.trim() }).single<TeamRow>()
  if (error) throw error
  return { id: data.id, name: data.name }
}

export async function joinTeam(client: SupabaseClient, code: string): Promise<TeamRef> {
  const { data, error } = await client.rpc('join_team', { code }).single<TeamRow>()
  if (error) throw error
  return { id: data.id, name: data.name }
}

export async function fetchTeamDetails(client: SupabaseClient, team: TeamRef, userId: string): Promise<TeamDetails> {
  const [teamResult, memberResult] = await Promise.all([
    client.from('teams').select('join_code').eq('id', team.id).single<{ join_code: string }>(),
    client
      .from('team_members')
      .select('role')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .single<{ role: TeamDetails['role'] }>(),
  ])
  if (teamResult.error) throw teamResult.error
  if (memberResult.error) throw memberResult.error
  return { code: teamResult.data.join_code, role: memberResult.data.role }
}

export async function regenerateJoinCode(client: SupabaseClient, team: TeamRef): Promise<string> {
  const { data, error } = await client.rpc('regenerate_join_code', { team: team.id })
  if (error) throw error
  return data as string
}

export async function leaveTeam(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('leave_team')
  if (error) throw error
}

/** `ABCD2345` as `ABCD-2345`, which is easier to read out. */
export function formatJoinCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

/** What a failed team request means for the person who made it. */
export function teamErrorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)
  switch (message) {
    case 'invalid_code':
      return 'No team has that code. Check it with whoever gave it to you.'
    case 'already_in_team':
      return 'This account is already in a team. Leave it from Settings → Team first.'
    case 'name_required':
      return 'Give the team a name.'
    case 'not_owner':
      return 'Only the team’s owner can change the code.'
    case 'not_signed_in':
      return 'You’ve been signed out. Sign in again to carry on.'
  }
  if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'You’re offline. This needs a connection.'
  }
  return message
}
