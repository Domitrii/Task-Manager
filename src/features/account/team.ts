/**
 * Teams on the server: see `supabase/migrations/20261008000000_teams.sql` and
 * `20261013000000_join_requests.sql`. Each person has their own account and
 * belongs to one team, which owns the records. A team code only asks to join:
 * the owner, or someone they allow, approves the request. Everything goes
 * through database functions, which check the code and who is asking.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TeamRef {
  id: string
  name: string
}

export type TeamRole = 'owner' | 'member'

export interface TeamDetails {
  code: string
  /** Owners can replace the code; everyone in the team can see and share it. */
  role: TeamRole
  /** Whether they can let new people in. Owners always can. */
  canApprove: boolean
  /** Whether they see every reading and can change any of them. Owners always do. */
  isManager: boolean
}

/** The team an account is in, and the role it asked to join with (null for whoever created the team). */
export interface Membership {
  team: TeamRef
  jobRole: string | null
}

/** This account's own request to join, until it's approved. */
export interface MyJoinRequest {
  team: TeamRef
  /** A listed role's key, or their own words: see `staffRoleFromText`. */
  jobRole: string
  status: 'pending' | 'declined'
}

/** Someone asking to join, as the people who can let them in see them. */
export interface JoinRequest {
  userId: string
  /** From their profile; empty if they haven't given one. */
  name: string
  email: string
  jobRole: string
  requestedAt: string
}

/** Someone with an account in the team. */
export interface TeamPerson {
  userId: string
  name: string
  jobRole: string | null
  role: TeamRole
  canApprove: boolean
  isManager: boolean
}

interface TeamRow {
  id: string
  name: string
  join_code: string
}

/** The team this account is in, or null if it hasn't been let into one. Throws when offline. */
export async function findMyTeam(client: SupabaseClient, userId: string): Promise<Membership | null> {
  const { data, error } = await client
    .from('team_members')
    .select('job_role, teams (id, name)')
    .eq('user_id', userId)
    .maybeSingle<{ job_role: string | null; teams: TeamRef | null }>()
  if (error) throw error
  return data?.teams ? { team: data.teams, jobRole: data.job_role } : null
}

export async function createTeam(client: SupabaseClient, name: string): Promise<TeamRef> {
  const { data, error } = await client.rpc('create_team', { team_name: name.trim() }).single<TeamRow>()
  if (error) throw error
  return { id: data.id, name: data.name }
}

/** The team a code belongs to, so the person can see it's the right one before asking. */
export async function findTeam(client: SupabaseClient, code: string): Promise<TeamRef> {
  const { data, error } = await client.rpc('find_team', { code }).single<TeamRef>()
  if (error) throw error
  return data
}

/** Asks to join, replacing any earlier request. They're in once someone approves it. */
export async function requestToJoin(client: SupabaseClient, code: string, jobRole: string): Promise<TeamRef> {
  const { data, error } = await client.rpc('request_to_join', { code, job_role: jobRole }).single<TeamRef>()
  if (error) throw error
  return data
}

export async function findMyJoinRequest(client: SupabaseClient): Promise<MyJoinRequest | null> {
  const { data, error } = await client
    .rpc('my_join_request')
    .maybeSingle<{ team_id: string; team_name: string; job_role: string; status: MyJoinRequest['status'] }>()
  if (error) throw error
  return data ? { team: { id: data.team_id, name: data.team_name }, jobRole: data.job_role, status: data.status } : null
}

export async function cancelJoinRequest(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('cancel_join_request')
  if (error) throw error
}

/** Who's waiting to join. Empty for anyone who can't approve them. */
export async function fetchJoinRequests(client: SupabaseClient, team: TeamRef): Promise<JoinRequest[]> {
  const { data, error } = await client.rpc('team_join_requests', { team: team.id })
  if (error) throw error
  const rows = data as { user_id: string; name: string; email: string; job_role: string; requested_at: string }[]
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    jobRole: row.job_role,
    requestedAt: row.requested_at,
  }))
}

export async function approveJoinRequest(client: SupabaseClient, team: TeamRef, userId: string): Promise<void> {
  const { error } = await client.rpc('approve_join_request', { team: team.id, person: userId })
  if (error) throw error
}

export async function declineJoinRequest(client: SupabaseClient, team: TeamRef, userId: string): Promise<void> {
  const { error } = await client.rpc('decline_join_request', { team: team.id, person: userId })
  if (error) throw error
}

export async function fetchTeamPeople(client: SupabaseClient, team: TeamRef): Promise<TeamPerson[]> {
  const { data, error } = await client.rpc('team_people', { team: team.id })
  if (error) throw error
  const rows = data as {
    user_id: string
    name: string
    job_role: string | null
    role: TeamRole
    can_approve: boolean
    is_manager: boolean
  }[]
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    jobRole: row.job_role,
    role: row.role,
    canApprove: row.can_approve,
    isManager: row.is_manager,
  }))
}

/** Lets someone in the team approve new people, or stops them. Owners only. */
export async function setApprover(client: SupabaseClient, team: TeamRef, userId: string, allowed: boolean): Promise<void> {
  const { error } = await client.rpc('set_join_approver', { team: team.id, person: userId, allowed })
  if (error) throw error
}

/** Makes someone a manager, or stops them being one. Owners only. */
export async function setManager(client: SupabaseClient, team: TeamRef, userId: string, allowed: boolean): Promise<void> {
  const { error } = await client.rpc('set_team_manager', { team: team.id, person: userId, allowed })
  if (error) throw error
}

/** What this account may do in its team. Throws when offline. */
export async function fetchMyAccess(
  client: SupabaseClient,
  team: TeamRef,
  userId: string,
): Promise<Omit<TeamDetails, 'code'>> {
  const { data, error } = await client
    .from('team_members')
    .select('role, can_approve, is_manager')
    .eq('team_id', team.id)
    .eq('user_id', userId)
    .single<{ role: TeamRole; can_approve: boolean; is_manager: boolean }>()
  if (error) throw error
  const owner = data.role === 'owner'
  return { role: data.role, canApprove: owner || data.can_approve, isManager: owner || data.is_manager }
}

export async function fetchTeamDetails(client: SupabaseClient, team: TeamRef, userId: string): Promise<TeamDetails> {
  const [teamResult, access] = await Promise.all([
    client.from('teams').select('join_code').eq('id', team.id).single<{ join_code: string }>(),
    fetchMyAccess(client, team, userId),
  ])
  if (teamResult.error) throw teamResult.error
  return { code: teamResult.data.join_code, ...access }
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
    case 'role_required':
      return 'Choose your role, or write it in under Other.'
    case 'not_owner':
      return 'Only the team’s owner can do that.'
    case 'not_allowed':
      return 'Only the team’s owner, or someone they allow, can let people in.'
    case 'request_gone':
      return 'Someone has already answered that request, or it was cancelled.'
    case 'not_in_team':
      return 'They’re no longer in the team.'
    case 'not_signed_in':
      return 'You’ve been signed out. Sign in again to carry on.'
  }
  if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'You’re offline. This needs a connection.'
  }
  return message
}
