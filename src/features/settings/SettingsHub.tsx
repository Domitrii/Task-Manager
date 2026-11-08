import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Bell, CircleHelp, RefreshCw, Sliders, Tablet, Thermometer, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { InfoCard, ListCard, Overline } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { SyncAvatar, syncSummary } from '@/components/layout/ProfileMenu'
import { useSync } from '@/features/account/sync'
import { staffName } from '@/data/selectors'
import type { StaffMember } from '@/data/types'
import { Avatar } from '@/components/ui/Avatar'
import { Field, Select, Toggle } from '@/components/ui/Field'
import { SetPinModal } from '@/features/account/SharedDevice'
import { LOCK_AFTER_CHOICES, readLockAfter, useSharedLock, writeLockAfter } from '@/features/account/sharedDeviceState'
import { useIsManager } from '@/features/temperatures/access'
import { NotificationToggles } from '@/features/notifications/NotificationToggles'
import { ReminderList } from '@/features/notifications/ReminderList'
import { failText, isApplianceItem, targetText } from '@/features/temperatures/thresholds'

const lastSyncText = (at: string | null | undefined) => (at ? format(parseISO(at), 'd MMM HH:mm') : 'Not yet')

/** Settings: a list of what there is to look at, each on its own page. */
export function SettingsHubPage() {
  const { data, activeStaff } = useStore()
  const sync = useSync()
  const goBack = useGoBack('/more')
  const appliances = data.items.filter((item) => item.active && isApplianceItem(item)).length

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" onBack={goBack} />
      <section>
        <Overline>Account and preferences</Overline>
        <div className="space-y-2.5">
          <ListCard
            to="/settings/account"
            icon={UserRound}
            title="Account and venue"
            subtitle={`${activeStaff.name} · ${data.settings.venueName}`}
          />
          <ListCard
            to="/settings/notifications"
            icon={Bell}
            title="Notifications"
            subtitle="Reminders, alerts and sign-off requests"
          />
          <ListCard
            to="/settings/device"
            icon={Tablet}
            title="Shared kitchen device"
            subtitle="Kitchen PINs, and passing a tablet between people"
          />
        </div>
      </section>
      <section>
        <Overline>Kitchen configuration</Overline>
        <div className="space-y-2.5">
          <ListCard
            to="/settings/thresholds"
            icon={Thermometer}
            title="Temperature thresholds and appliances"
            subtitle={`${appliances} ${appliances === 1 ? 'appliance' : 'appliances'} · Manager configuration`}
          />
          <ListCard
            to="/settings/sync"
            icon={RefreshCw}
            title="Sync"
            subtitle={sync ? `${syncSummary(sync.status).label} · Last sync ${lastSyncText(sync.status.lastSyncedAt)}` : 'This device only'}
          />
          <ListCard
            to="/settings/manage"
            icon={Sliders}
            title="Venue, team and data"
            subtitle="Check windows, equipment, staff, suppliers and templates"
          />
        </div>
      </section>
      <section>
        <Overline>Support</Overline>
        <ListCard to="/settings/help" icon={CircleHelp} title="Help" subtitle="A quick kitchen guide" />
      </section>
    </div>
  )
}

export function AccountVenuePage() {
  const now = useNow()
  const { data, activeStaff } = useStore()
  const sync = useSync()
  const goBack = useGoBack('/settings')
  const { venueName, address } = data.settings

  return (
    <div className="space-y-3.5">
      <PageHeader title="Account and venue" onBack={goBack} />
      <InfoCard title="Account">
        <p className="text-ink font-semibold">{activeStaff.name}</p>
        {sync ? <p className="text-ink">{sync.email}</p> : null}
        <p className="text-ink">Role · {staffRoleLabel(activeStaff)}</p>
      </InfoCard>
      <InfoCard title="Venue">
        <p className="text-ink font-semibold">{venueName}</p>
        {address ? <p className="text-ink">{address}</p> : null}
        <p>Dates use UK format · {format(now, 'd MMM yyyy')}</p>
        <p>Times use the 24-hour clock · {format(now, 'HH:mm')}</p>
        <p>Today · {format(now, 'EEE d MMM yyyy')}</p>
      </InfoCard>
      <p className="text-ink-muted text-[13px]">
        Account and venue information is read-only here. Ask your duty manager if these details need correcting.
      </p>
    </div>
  )
}

export function NotificationSettingsPage() {
  const { data } = useStore()
  const goBack = useGoBack('/settings')
  return (
    <div className="space-y-3.5">
      <PageHeader title="Notifications" onBack={goBack} />
      <p className="text-ink-muted text-[13px]">Choose your app preferences for {data.settings.venueName}.</p>
      <NotificationToggles />
      <ReminderList />
    </div>
  )
}

export function ThresholdsPage() {
  const { data } = useStore()
  const navigate = useNavigate()
  const goBack = useGoBack('/settings')
  const appliances = data.items.filter((item) => item.active && isApplianceItem(item))

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Temperature thresholds" onBack={goBack} />
      <p className="text-ink-muted text-[13px]">
        Managers confirm real values and permissions; these are not safety guidance.
      </p>
      {appliances.map((item) => (
        <InfoCard key={item.id} title={item.name}>
          <p className="text-ink">{targetText(item)}</p>
          <p>Failure · {failText(item)}</p>
        </InfoCard>
      ))}
      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => navigate('/settings/manage?tab=equipment')}>
          Manage appliances
        </Button>
      </PinnedAction>
    </div>
  )
}

export function SyncPage() {
  const { data } = useStore()
  const sync = useSync()
  const goBack = useGoBack('/settings')
  // When the last sync had finished at the moment someone asked for another.
  const [askedAfter, setAskedAfter] = useState<string | null | undefined>(undefined)
  const status = sync?.status
  const venue = data.settings.venueName
  // Only true once the sync they asked for has landed, not the one before it.
  const finished =
    askedAfter !== undefined && status?.state === 'synced' && status.pending === 0 && status.lastSyncedAt !== askedAfter

  if (!sync || !status) {
    return (
      <div className="space-y-3.5">
        <PageHeader title="Sync" onBack={goBack} />
        <InfoCard title="This device only">
          <p>{venue} isn’t linked to a team account, so its records stay on this device.</p>
        </InfoCard>
      </div>
    )
  }

  const { tone, label } = syncSummary(status)
  const offline = status.state === 'offline'
  const clear = tone === 'pass'

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Sync" onBack={goBack} />

      <InfoCard title={offline ? 'Offline' : clear ? 'Everything is synced' : label}>
        <div className="flex items-center gap-3 py-1">
          <SyncAvatar tone={tone} filled />
          <div>
            <p className="text-ink font-semibold">{clear ? 'Synced' : status.pending > 0 ? 'Pending local changes' : label}</p>
            <p>Last synced {lastSyncText(status.lastSyncedAt)}</p>
          </div>
        </div>
        {clear ? (
          <Badge tone="pass">All changes synced</Badge>
        ) : (
          <Badge tone="warn">{offline ? `Offline · ${status.pending} pending` : label}</Badge>
        )}
      </InfoCard>

      <InfoCard title={status.pending > 0 ? 'Saved on this device' : 'This venue'}>
        {status.pending > 0 ? (
          <>
            <p className="text-ink">
              {status.pending} local {status.pending === 1 ? 'change is' : 'changes are'} waiting to sync.
            </p>
            <p>
              Cached records remain available.{offline ? ' Sync now is disabled while offline.' : ''} Reconnect before
              signing out, and don’t clear this device’s data.
            </p>
          </>
        ) : (
          <>
            <p className="text-ink">{venue}</p>
            <p>No pending local changes. Your recorded work is available on this device.</p>
          </>
        )}
      </InfoCard>

      {finished ? <Banner tone="pass" title="Sync complete" /> : null}

      <PinnedAction>
        <Button
          block
          size="lg"
          variant={offline ? 'secondary' : 'primary'}
          disabled={offline}
          onClick={() => {
            setAskedAfter(status.lastSyncedAt)
            sync.syncNow()
          }}
        >
          Sync now
        </Button>
      </PinnedAction>
    </div>
  )
}

export function HelpPage() {
  const goBack = useGoBack('/settings')
  return (
    <div className="space-y-3.5">
      <PageHeader title="Help" onBack={goBack} />
      <InfoCard title="A quick kitchen guide">
        <p>Record what happened, keep the original reading, and make the next step clear for your team.</p>
        <p>For venue procedures or urgent concerns, ask your duty manager.</p>
      </InfoCard>
      <InfoCard title="A reading is out of range">
        <p>
          Record the actual temperature and the corrective action taken. Keep the failed reading; record a recheck as a
          separate event. Follow your venue’s procedure and tell your duty manager.
        </p>
      </InfoCard>
      <InfoCard title="Working offline">
        <p>
          Records can stay on this device as pending local changes. Check Settings → Sync after reconnecting and confirm
          that all changes are synced.
        </p>
      </InfoCard>
    </div>
  )
}

/** Turning a tablet into a shared kitchen device, and everyone's kitchen PINs. */
export function SharedDevicePage() {
  const { data, activeStaff, sharedDevice, setSharedDevice } = useStore()
  const sync = useSync()
  const manager = useIsManager()
  const shared = useSharedLock()
  const goBack = useGoBack('/settings')
  const [settingPin, setSettingPin] = useState<StaffMember | null>(null)
  const [lockAfter, setLockAfter] = useState(readLockAfter)
  const people = data.staff.filter((person) => person.active)
  // Only the account signed in on the tablet decides, and only while they're the one at it.
  const signedInManager = Boolean(sync?.isManager) && activeStaff.userId === sync?.userId
  const ownPin = Boolean(activeStaff.pinHash)

  return (
    <div className="space-y-3.5">
      <PageHeader title="Shared kitchen device" onBack={goBack} />
      {sync ? (
        <InfoCard title="This device">
          <p>
            For a tablet that stays in the kitchen. A manager signs in on it once; after that, people tap their name
            and enter their PIN, so what they record goes down in their name and they can do what they can on their own
            phone. It locks itself when nobody has used it for a while.
          </p>
          <div className="pt-2">
            {signedInManager || sharedDevice ? (
              <ToggleRowPlain
                title="Use as a shared kitchen device"
                description={
                  sharedDevice
                    ? `Signed in as ${staffName(data, data.staff.find((person) => person.userId === sync.userId)?.id)}.`
                    : ownPin
                      ? 'You’ll stay signed in here; others use their PIN.'
                      : 'Set your own PIN first, below.'
                }
                checked={sharedDevice}
                disabled={!signedInManager || (!sharedDevice && !ownPin)}
                onChange={setSharedDevice}
              />
            ) : (
              <p className="text-ink">Only a manager can set this up, signed in on the tablet.</p>
            )}
          </div>
          {sharedDevice ? (
            <>
              <Field label="Lock after" htmlFor="lock-after" className="pt-2">
                <Select
                  id="lock-after"
                  value={lockAfter}
                  onChange={(event) => {
                    const minutes = Number(event.target.value)
                    writeLockAfter(minutes)
                    setLockAfter(minutes)
                  }}
                >
                  {LOCK_AFTER_CHOICES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes without use
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="pt-1">
                The tablet stays signed in as a manager. Someone who got round the app on it could do what a manager
                can, so keep it where the team works.
              </p>
              <div className="pt-2">
                <Button onClick={shared.lock}>Lock now</Button>
              </div>
            </>
          ) : null}
        </InfoCard>
      ) : (
        <InfoCard title="This device">
          <p>
            Anyone can switch person from the menu at the top. Someone with a kitchen PIN needs it to switch to them.
          </p>
        </InfoCard>
      )}

      <section aria-labelledby="kitchen-pins" className="space-y-2.5">
        <h2 id="kitchen-pins" className="font-display text-ink text-lg font-bold">
          Kitchen PINs
        </h2>
        <p className="text-ink-muted text-[13px]">
          {manager
            ? 'You can set anyone’s PIN, for people without a phone of their own. PINs are never shown, only checked.'
            : 'You can set your own. A manager can set anyone’s.'}
        </p>
        <ul className="bg-surface border-line divide-line divide-y rounded-xl border">
          {people.map((person) => {
            const mine = person.id === activeStaff.id
            return (
              <li key={person.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar person={person} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate text-sm font-medium">{person.name}</p>
                  <p className="text-ink-muted text-xs">{person.pinHash ? 'PIN set' : 'No PIN'}</p>
                </div>
                {manager || mine ? (
                  <Button size="sm" variant="ghost" onClick={() => setSettingPin(person)} aria-label={`Set ${person.name}’s PIN`}>
                    {person.pinHash ? 'Change' : 'Set PIN'}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {settingPin ? <SetPinModal person={settingPin} onClose={() => setSettingPin(null)} /> : null}
    </div>
  )
}

/** A switch in a row of its own, inside a card. */
function ToggleRowPlain({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-semibold">{title}</p>
        <p className="text-ink-muted text-xs">{description}</p>
      </div>
      {disabled ? (
        <span className="text-ink-subtle text-xs">{checked ? 'On' : 'Off'}</span>
      ) : (
        <Toggle checked={checked} onChange={onChange} label={title} />
      )}
    </div>
  )
}
