import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { jobRoleLabel, staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import { formatAgo } from '@/lib/format'
import { initialsOf } from '@/lib/utils'
import type { SyncApi } from './sync'
import { teamErrorMessage, type JoinRequest, type TeamPerson } from './team'

const LIST = 'bg-surface border-line divide-line mt-2 divide-y rounded-xl border'
const HEADING = 'text-ink text-[13px] font-semibold'

/** People asking to join, for the owner and anyone they allow. Renders nothing when nobody is waiting. */
export function JoinRequestList({ sync, onApproved }: { sync: SyncApi; onApproved: () => void }) {
  const toast = useToast()
  const [answering, setAnswering] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { joinRequests, refreshJoinRequests } = sync

  // Opening Settings shouldn't wait for the next regular check.
  useEffect(() => refreshJoinRequests(), [refreshJoinRequests])

  if (joinRequests.length === 0) return null

  async function answer(request: JoinRequest, approve: boolean) {
    setAnswering(request.userId)
    setError(null)
    const who = request.name || request.email
    try {
      if (approve) {
        await sync.approveJoin(request.userId)
        toast.success(`${who} is in`, 'They’ll appear in the team list once they open Mise.')
        onApproved()
      } else {
        await sync.declineJoin(request.userId)
        toast.success('Request declined', `${who} can’t see ${sync.team.name}’s records.`)
      }
    } catch (failure) {
      setError(teamErrorMessage(failure))
    } finally {
      setAnswering(null)
    }
  }

  return (
    <section aria-labelledby="join-requests-heading">
      <h3 id="join-requests-heading" className={HEADING}>
        Asking to join ({joinRequests.length})
      </h3>
      <ul className={LIST}>
        {joinRequests.map((request) => {
          const who = request.name || request.email
          const busy = answering === request.userId
          return (
            <li key={request.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
              <Avatar person={{ id: request.userId, name: who, initials: initialsOf(who) }} />
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-medium">{who}</p>
                <p className="text-ink-muted truncate text-xs">
                  {[jobRoleLabel(request.jobRole), request.name ? request.email : null].filter(Boolean).join(' · ')}
                </p>
                <p className="text-ink-subtle text-xs">Asked {formatAgo(request.requestedAt)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={answering !== null}
                  onClick={() => void answer(request, false)}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={answering !== null}
                  onClick={() => void answer(request, true)}
                >
                  {busy ? 'Approving…' : 'Approve'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-fail-600 dark:text-fail-500 mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  )
}

/** The owner's choice of who else can let people in. `version` changes when someone new joins. */
export function ApproverList({ sync, version }: { sync: SyncApi; version: number }) {
  const { data } = useStore()
  const [people, setPeople] = useState<TeamPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { teamPeople } = sync
  useEffect(() => {
    let live = true
    teamPeople().then(
      (loaded) => live && setPeople(loaded),
      (failure: unknown) => live && setError(teamErrorMessage(failure)),
    )
    return () => {
      live = false
    }
  }, [teamPeople, version])

  async function allow(person: TeamPerson, allowed: boolean) {
    const set = (value: boolean) =>
      setPeople((list) => list?.map((entry) => (entry.userId === person.userId ? { ...entry, canApprove: value } : entry)) ?? null)
    // Switched straight away, and back if the server says no.
    set(allowed)
    setError(null)
    try {
      await sync.setApprover(person.userId, allowed)
    } catch (failure) {
      set(!allowed)
      setError(teamErrorMessage(failure))
    }
  }

  const others = people?.filter((person) => person.role !== 'owner') ?? []

  return (
    <section aria-labelledby="approvers-heading">
      <h3 id="approvers-heading" className={HEADING}>
        Who can let people in
      </h3>
      <p className="text-ink-muted mt-0.5 text-[13px]">
        You always can. Switch it on for anyone else who should approve new people.
      </p>
      {people === null ? (
        error ? null : <p className="text-ink-subtle mt-2 text-sm">Loading…</p>
      ) : others.length === 0 ? (
        <p className="text-ink-subtle mt-2 text-sm">Nobody else has joined yet.</p>
      ) : (
        <ul className={LIST}>
          {others.map((person) => {
            // Their staff record has the role as it's kept now, if they've opened the app since joining.
            const staff = data.staff.find((member) => member.userId === person.userId)
            const who = person.name || staff?.name || 'No name yet'
            return (
              <li key={person.userId} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar person={staff ?? { id: person.userId, name: who, initials: initialsOf(who) }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-sm font-medium">{who}</p>
                  <p className="text-ink-muted truncate text-xs">
                    {staff ? staffRoleLabel(staff) : jobRoleLabel(person.jobRole)}
                  </p>
                </div>
                <Toggle
                  label={`${who} can let people in`}
                  checked={person.canApprove}
                  onChange={(value) => void allow(person, value)}
                />
              </li>
            )
          })}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-fail-600 dark:text-fail-500 mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  )
}
