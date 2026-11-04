import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Bell, CircleHelp, RefreshCw, Sliders, Thermometer, UserRound } from 'lucide-react'
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
import { NotificationToggles } from '@/features/notifications/NotificationToggles'
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
      <InfoCard title="Device permission">
        <p>These are app preferences, not device notification permission.</p>
        <p>Your phone’s notification settings control whether alerts can appear.</p>
      </InfoCard>
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
