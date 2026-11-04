import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { ChevronRight, Clock, ClipboardList, SearchX, TriangleAlert, UserRound } from 'lucide-react'
import { shiftState } from '@/data/shifts'
import { STAFF_ROLE_LABELS, staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import type { Certificate, Invitation, StaffMember } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { SearchField } from '@/components/shared/SearchField'
import { InviteMemberModal } from './InviteMemberModal'

/** How long before a certificate runs out that it starts to say so. */
const DUE_SOON_DAYS = 30

export function certificateState(certificate: Certificate, now: Date): 'ok' | 'due-soon' | 'expired' {
  const left = differenceInCalendarDays(parseISO(certificate.expiresOn), now)
  if (left < 0) return 'expired'
  return left <= DUE_SOON_DAYS ? 'due-soon' : 'ok'
}

/** Whether someone is at work right now. */
export function useClockedIn(): (staffId: string) => boolean {
  const now = useNow()
  const { data } = useStore()
  const today = toISODate(now)
  const on = useMemo(
    () =>
      new Set(
        data.shifts
          .filter((shift) => shift.date === today && shiftState(shift) === 'clocked-in')
          .map((shift) => shift.staffId),
      ),
    [data.shifts, today],
  )
  return (staffId) => on.has(staffId)
}

function needsRenewal(member: StaffMember, now: Date): boolean {
  return (member.certificates ?? []).some((certificate) => certificateState(certificate, now) !== 'ok')
}

export function TeamPage() {
  const now = useNow()
  const { data } = useStore()
  const goBack = useGoBack('/more')
  const clockedIn = useClockedIn()
  const [query, setQuery] = useState('')
  const [inviting, setInviting] = useState(false)

  const staff = useMemo(() => data.staff.filter((person) => person.active), [data.staff])
  const needle = query.trim().toLowerCase()
  const shown = staff.filter((person) => `${person.name} ${staffRoleLabel(person)}`.toLowerCase().includes(needle))
  const joined = new Set(staff.map((person) => person.email?.toLowerCase()))
  const pending = data.invitations.filter((invitation) => !joined.has(invitation.email.toLowerCase()))
  const onShift = staff.filter((person) => clockedIn(person.id)).length

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Team" onBack={goBack} />

      {staff.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No team members yet"
          description="Invite your kitchen team to share records and follow up on issues."
        />
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} placeholder="Search team" />
          <p className="text-ink-muted text-[13px]">
            {data.settings.venueName} · {staff.length} staff · {onShift} clocked in
          </p>
          {pending.map((invitation) => (
            <PendingInvitation key={invitation.id} invitation={invitation} />
          ))}
          {shown.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No matching people"
              description={`No results for “${query.trim()}”. Try another name.`}
              action={<Button onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : (
            <ul className="space-y-2.5">
              {shown.map((person) => (
                <li key={person.id}>
                  <ListCard
                    to={`/team/${person.id}`}
                    icon={UserRound}
                    title={person.name}
                    subtitle={`${staffRoleLabel(person)} · ${clockedIn(person.id) ? 'Clocked in' : 'Clocked out'}`}
                  >
                    {needsRenewal(person, now) ? (
                      <Badge tone="warn" icon={<TriangleAlert className="size-3.5" />}>
                        Due soon
                      </Badge>
                    ) : null}
                  </ListCard>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Link
        to="/settings/manage?tab=staff"
        className="text-brand-700 dark:text-brand-300 flex items-center gap-1 py-1 text-sm font-semibold"
      >
        Join code, approvals and permissions
        <ChevronRight className="size-4" />
      </Link>

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setInviting(true)}>
          Invite member
        </Button>
      </PinnedAction>
      {inviting ? <InviteMemberModal onClose={() => setInviting(false)} /> : null}
    </div>
  )
}

function PendingInvitation({ invitation }: { invitation: Invitation }) {
  const { data, deleteInvitation } = useStore()
  return (
    <section className="bg-surface shadow-card rounded-card p-3.5">
      <h2 className="text-ink text-[15px] font-semibold">Pending invitation</h2>
      <p className="text-ink mt-1 text-[13px] break-all">{invitation.email}</p>
      <p className="text-ink-muted text-[13px]">
        {STAFF_ROLE_LABELS[invitation.role]} · {data.settings.venueName}
      </p>
      <Badge icon={<Clock className="size-3.5" />} className="mt-1.5">
        Invite pending
      </Badge>
      <p className="text-ink-muted mt-1.5 text-xs">
        Not an active staff member. Clock status and training are not available until they join.
      </p>
      <Button size="sm" className="mt-2" onClick={() => deleteInvitation(invitation.id)}>
        Remove invitation
      </Button>
    </section>
  )
}
