import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { jobRoleLabel, staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import { formatAgo } from '@/lib/format'
import { initialsOf } from '@/lib/utils'
import { EDIT_MINUTES } from '@/features/temperatures/access'
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

type Permission = 'isManager' | 'canApprove'

const PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'isManager', label: 'Manager' },
  { key: 'canApprove', label: 'Lets people in' },
]

/**
 * The owner's choice of what everyone else may do: be a manager (see every
 * reading and change any of them) and let new people in. The owner can also
 * take anyone out of the team, and managers can take out anyone who isn't one;
 * managers see the list for that alone. `version` changes when someone new joins.
 */
export function PermissionList({ sync, version, owner }: { sync: SyncApi; version: number; owner: boolean }) {
  const { data } = useStore()
  const toast = useToast()
  const [people, setPeople] = useState<TeamPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ person: TeamPerson; who: string } | null>(null)
  const [busy, setBusy] = useState(false)

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

  async function allow(person: TeamPerson, permission: Permission, allowed: boolean) {
    const set = (value: boolean) =>
      setPeople(
        (list) =>
          list?.map((entry) => (entry.userId === person.userId ? { ...entry, [permission]: value } : entry)) ?? null,
      )
    // Switched straight away, and back if the server says no.
    set(allowed)
    setError(null)
    try {
      if (permission === 'isManager') await sync.setManager(person.userId, allowed)
      else await sync.setApprover(person.userId, allowed)
    } catch (failure) {
      set(!allowed)
      setError(teamErrorMessage(failure))
    }
  }

  async function remove() {
    if (!removing) return
    setBusy(true)
    setError(null)
    try {
      await sync.removeMember(removing.person.userId)
      setPeople((list) => list?.filter((entry) => entry.userId !== removing.person.userId) ?? null)
      toast.success(`${removing.who} is out of the team`, 'Their records stay, in their name.')
      setRemoving(null)
    } catch (failure) {
      setError(teamErrorMessage(failure))
      setRemoving(null)
    } finally {
      setBusy(false)
    }
  }

  const others =
    people?.filter((person) => person.role !== 'owner' && (owner || !person.isManager)) ?? []

  return (
    <section aria-labelledby="permissions-heading">
      <h3 id="permissions-heading" className={HEADING}>
        {owner ? 'What people can do' : 'People in the team'}
      </h3>
      <p className="text-ink-muted mt-0.5 text-[13px]">
        {owner
          ? `As the owner you can do everything. Managers see every reading with its photo and can change any of them at any time; everyone else can change their own for ${EDIT_MINUTES} minutes. Only managers can record something in someone else’s name.`
          : 'As a manager you can take someone out of the team, for example when they leave. Only the owner can take out another manager.'}
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
              <li key={person.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                <Avatar person={staff ?? { id: person.userId, name: who, initials: initialsOf(who) }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-sm font-medium">{who}</p>
                  <p className="text-ink-muted truncate text-xs">
                    {staff ? staffRoleLabel(staff) : jobRoleLabel(person.jobRole)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {owner
                    ? PERMISSIONS.map(({ key, label }) => (
                        <span key={key} className="flex items-center gap-2">
                          <span className="text-ink-muted text-xs font-medium" aria-hidden>
                            {label}
                          </span>
                          <Toggle
                            label={`${who}: ${label}`}
                            checked={person[key]}
                            onChange={(value) => void allow(person, key, value)}
                          />
                        </span>
                      ))
                    : null}
                  <Button size="sm" variant="ghost" onClick={() => setRemoving({ person, who })} aria-label={`Remove ${who} from the team`}>
                    Remove
                  </Button>
                </div>
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
      {removing ? (
        <Modal
          open
          variant="alert"
          onClose={() => (busy ? undefined : setRemoving(null))}
          title={`Remove ${removing.who} from ${sync.team.name}?`}
          description="They lose access on every device straight away. Everything they recorded stays, in their name. They can ask to join again with the team code."
          footer={
            <>
              <Button variant="danger" disabled={busy} onClick={() => void remove()}>
                {busy ? 'Removing…' : 'Remove from team'}
              </Button>
              <Button disabled={busy} onClick={() => setRemoving(null)}>
                Cancel
              </Button>
            </>
          }
        />
      ) : null}
    </section>
  )
}
