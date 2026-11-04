import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CircleAlert, RefreshCw, UserRound } from 'lucide-react'
import { staffRoleLabel } from '@/data/staffRoles'
import type { SyncStatus } from '@/data/supabaseRepository'
import { useStore } from '@/data/store'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, MenuDivider, MenuItem, MenuLabel } from '@/components/ui/Menu'
import { SignOutModal } from '@/features/account/AccountCard'
import { useSync } from '@/features/account/sync'

type SyncTone = 'pass' | 'warn' | 'fail'

const changes = (count: number) => `${count} ${count === 1 ? 'change' : 'changes'}`

/** Where this device's records stand, in the few words beside the avatar. */
export function syncSummary(status: SyncStatus): { tone: SyncTone; label: string } {
  const { state, pending, lastSyncedAt } = status
  if (state === 'signed-out' || state === 'error') {
    return { tone: 'fail', label: pending > 0 ? `${changes(pending)} not synced` : 'Not syncing' }
  }
  if (state === 'offline') return pending > 0 ? { tone: 'fail', label: `${changes(pending)} not synced` } : { tone: 'warn', label: 'Offline' }
  if (pending > 0) return { tone: 'warn', label: 'Syncing…' }
  return { tone: 'pass', label: lastSyncedAt ? `Synced ${formatTime(lastSyncedAt)}` : 'Synced' }
}

const RING: Record<SyncTone, string> = {
  pass: 'border-pass-500',
  warn: 'border-warn-500',
  fail: 'border-fail-500',
}

const MARK: Record<SyncTone, { icon: typeof Check; className: string }> = {
  pass: { icon: Check, className: 'bg-pass-50 text-pass-600' },
  warn: { icon: RefreshCw, className: 'bg-warn-50 text-warn-700' },
  fail: { icon: CircleAlert, className: 'bg-fail-50 text-fail-600' },
}

/** The person, ringed in the colour of how their device's records stand. */
export function SyncAvatar({ tone, filled = false }: { tone: SyncTone | null; filled?: boolean }) {
  const mark = tone ? MARK[tone] : null
  return (
    <span
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center rounded-full border-2',
        tone ? RING[tone] : 'border-white/50',
        filled ? 'bg-brand-700 border-brand-700 text-white' : 'text-white',
        filled && tone && RING[tone],
      )}
    >
      <UserRound className="size-5" strokeWidth={1.8} />
      {mark ? (
        <span
          className={cn(
            'absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full ring-2 ring-white',
            mark.className,
          )}
        >
          <mark.icon className="size-3" strokeWidth={2.75} />
        </span>
      ) : null}
    </span>
  )
}

/** Who's signed in, and everything to do with them. */
export function ProfileMenu() {
  const { data, activeStaff, setActiveStaffId } = useStore()
  const sync = useSync()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const status = sync ? syncSummary(sync.status) : null
  const go = (to: string, close: () => void) => {
    navigate(to)
    close()
  }

  return (
    <>
      <Menu
        width="w-72"
        className="ml-1"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-label={sync ? `Signed in as ${activeStaff.name}` : `Signed in as ${activeStaff.name}. Switch person`}
            className="flex items-center gap-2.5 rounded-full"
          >
            <SyncAvatar tone={status?.tone ?? null} />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <div className="px-3.5 pt-2.5 pb-1">
              <p className="text-ink truncate text-[15px] font-semibold">{activeStaff.name}</p>
              <p className="text-ink-muted truncate text-[13px]">{sync?.email ?? staffRoleLabel(activeStaff)}</p>
            </div>

            {sync && status ? (
              <button
                type="button"
                onClick={() => {
                  sync.syncNow()
                  close()
                }}
                aria-label={`${status.label}. Sync now`}
                className="hover:bg-surface-muted flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors"
              >
                <SyncAvatar tone={status.tone} filled />
                <span className="text-ink min-w-0 flex-1 truncate text-[13px]">{status.label}</span>
              </button>
            ) : null}

            {/* Signed in, everyone is on their own account; only a device-only venue passes the device round. */}
            {sync ? null : (
              <>
                <MenuLabel>Who's using this device?</MenuLabel>
                {data.staff
                  .filter((person) => person.active)
                  .map((person) => (
                    <MenuItem
                      key={person.id}
                      icon={<Avatar person={person} size="xs" />}
                      onClick={() => {
                        setActiveStaffId(person.id)
                        close()
                      }}
                      description={staffRoleLabel(person)}
                    >
                      <span className="flex items-center gap-2">
                        {person.name}
                        {person.id === activeStaff.id ? <Check className="text-brand-600 size-3.5" /> : null}
                      </span>
                    </MenuItem>
                  ))}
                <MenuDivider />
              </>
            )}

            <MenuItem onClick={() => go('/profile', close)}>Your profile</MenuItem>
            <MenuItem onClick={() => go('/team', close)}>Team</MenuItem>
            {sync ? (
              <MenuItem
                tone="danger"
                onClick={() => {
                  setSigningOut(true)
                  close()
                }}
              >
                Sign out
              </MenuItem>
            ) : null}
          </>
        )}
      </Menu>

      {sync && signingOut ? <SignOutModal sync={sync} onClose={() => setSigningOut(false)} /> : null}
    </>
  )
}
