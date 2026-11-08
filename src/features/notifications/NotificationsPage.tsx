import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmClock, ChevronRight, CircleAlert, ClipboardList, FileText, SearchX, Thermometer, Truck, type LucideIcon } from 'lucide-react'
import { ALERT_GROUPS, type Alert } from '@/data/attention'
import { isFinished } from '@/data/reminders'
import { useStore } from '@/data/store'
import { useGoBack } from '@/lib/useGoBack'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchField } from '@/components/shared/SearchField'
import { SortMenu, type SortOrder } from '@/components/shared/SortMenu'
import { useAlerts } from './useAlerts'

const ICONS: Record<Alert['kind'], LucideIcon> = {
  tasks: FileText,
  temperatures: Thermometer,
  signoff: ClipboardList,
  always: Truck,
  reminder: AlarmClock,
}

export function NotificationsPage() {
  const { data, activeStaff } = useStore()
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const { alerts, unread, isRead, markRead, markAllRead } = useAlerts()
  const reminderCount = (activeStaff.reminders ?? []).filter((reminder) => reminder.on && !isFinished(reminder, new Date())).length
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [justRead, setJustRead] = useState(false)

  const needle = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const shown = alerts
      .filter((alert) => !needle || `${alert.title} ${alert.who ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'priority' ? a.rank - b.rank : 0) || b.at.localeCompare(a.at))
    return ALERT_GROUPS.map((group) => ({
      ...group,
      alerts: shown.filter((alert) => alert.group === group.key),
    })).filter((group) => group.alerts.length > 0)
  }, [alerts, needle, sort])

  function open(alert: Alert) {
    markRead(alert)
    navigate(alert.to)
  }

  return (
    <div className="space-y-3.5">
      <PageHeader title="Notifications" onBack={goBack} />
      <p className="text-ink-muted text-[13px]">{data.settings.venueName}</p>
      <ListCard
        to="/settings/notifications"
        icon={AlarmClock}
        title="Set a reminder"
        subtitle={reminderCount > 0 ? `${reminderCount} set` : 'Choose a time to check everything'}
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No reminders"
          description="Checklist reminders will appear here when a task is missed, overdue or coming soon."
          action={<ButtonLink to="/tasks">Back to Checklist</ButtonLink>}
        />
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} placeholder="Search reminders" />
          <div className="grid grid-cols-2 gap-2.5">
            <SortMenu value={sort} onChange={setSort} showValue align="left" />
            <Button
              disabled={unread.length === 0}
              onClick={() => {
                markAllRead()
                setJustRead(true)
              }}
            >
              {unread.length === 0 ? 'All read' : 'Mark all read'}
            </Button>
          </div>

          {justRead && unread.length === 0 ? <Banner tone="pass" title="All notifications marked as read" /> : null}

          {groups.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No matching reminders"
              description={`No reminders match “${query.trim()}”. Try another task name or clear your search.`}
              action={<Button onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-label={group.label} className="space-y-2.5">
                <h2 className="font-display text-ink text-lg font-bold">{group.label}</h2>
                {group.alerts.map((alert) => (
                  <AlertCard key={alert.key} alert={alert} read={isRead(alert)} onOpen={() => open(alert)} />
                ))}
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

function AlertCard({ alert, read, onOpen }: { alert: Alert; read: boolean; onOpen: () => void }) {
  const Icon = ICONS[alert.kind]
  return (
    <button type="button" onClick={onOpen} className="bg-surface shadow-card rounded-card block w-full p-3.5 text-left">
      <span className="flex items-center justify-between gap-3">
        <Badge tone={alert.tone} icon={<CircleAlert className="size-3.5" />}>
          {alert.status}
        </Badge>
        <span className="text-ink-subtle shrink-0 text-xs">{read ? 'Read' : '• Unread'}</span>
      </span>
      <span className="mt-2.5 flex items-center gap-3">
        <Icon className="text-ink-muted size-5 shrink-0" strokeWidth={1.8} />
        <span className="min-w-0 flex-1">
          <span className="text-ink block text-[15px] leading-snug font-semibold">{alert.title}</span>
          <span className="text-ink-muted mt-0.5 block text-[13px]">{alert.detail}</span>
          {alert.who ? <span className="text-ink-subtle block text-xs">{alert.who}</span> : null}
        </span>
        <ChevronRight className="text-ink-muted size-5 shrink-0" />
      </span>
    </button>
  )
}
