import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LogoMark } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/data/store'
import { useSync } from '@/features/account/sync'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { HoursPage } from '@/features/calendar/HoursPage'
import { ShiftDetailPage } from '@/features/calendar/ShiftDetailPage'
import { DeliveriesPage } from '@/features/deliveries/DeliveriesPage'
import { DeliveriesBoard } from '@/features/deliveries/DeliveriesBoard'
import { ExpectedDeliveryPage, ReceivedDeliveryPage } from '@/features/deliveries/DeliveryPages'
import { ChecklistsPage } from '@/features/checklists/pages'
import { IssueDetailPage } from '@/features/issues/IssueDetailPage'
import { IssuesPage } from '@/features/issues/IssuesPage'
import { MorePage } from '@/features/more/MorePage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { StockItemPage } from '@/features/stock/StockItemPage'
import { StockPage } from '@/features/stock/StockPage'
import { SupplierDetailPage } from '@/features/suppliers/SupplierDetailPage'
import { SuppliersListPage } from '@/features/suppliers/SuppliersListPage'
import { SuppliersPage } from '@/features/suppliers/SuppliersPage'
import { StaffDetailPage } from '@/features/team/StaffDetailPage'
import { TeamPage } from '@/features/team/TeamPage'
import { ApplianceDetailPage } from '@/features/temperatures/ApplianceDetailPage'
import { FoodProbePage } from '@/features/temperatures/FoodProbePage'
import { TempsPage } from '@/features/temperatures/TempsPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { ScanPage } from '@/features/qr/ScanPage'
import { TodayPage } from '@/features/today/TodayPage'

// Reports and Settings are visited far less than the daily-entry screens, so
// they load on demand rather than adding to the first paint on the pass.
const InspectionPackPage = lazy(async () => ({
  default: (await import('@/features/reports/InspectionPackPage')).InspectionPackPage,
}))
const ReportsPage = lazy(async () => ({
  default: (await import('@/features/reports/ReportsPage')).ReportsPage,
}))
const SettingsPage = lazy(async () => ({
  default: (await import('@/features/settings/SettingsPage')).SettingsPage,
}))
const settingsPage = <Name extends keyof typeof import('@/features/settings/SettingsHub')>(name: Name) =>
  lazy(async () => ({ default: (await import('@/features/settings/SettingsHub'))[name] }))
const SettingsHubPage = settingsPage('SettingsHubPage')
const AccountVenuePage = settingsPage('AccountVenuePage')
const NotificationSettingsPage = settingsPage('NotificationSettingsPage')
const SharedDevicePage = settingsPage('SharedDevicePage')
const ThresholdsPage = settingsPage('ThresholdsPage')
const SyncPage = settingsPage('SyncPage')
const HelpPage = settingsPage('HelpPage')
const QrLabelsPage = lazy(async () => ({
  default: (await import('@/features/qr/QrLabelsPage')).QrLabelsPage,
}))
const TemplatesPage = lazy(async () => ({
  default: (await import('@/features/templates/TemplatesPage')).TemplatesPage,
}))
const TemplateEditorRoutes = lazy(async () => ({
  default: (await import('@/features/templates/TemplateEditorRoutes')).TemplateEditorRoutes,
}))
// Setup runs once per venue, so its packs stay out of the everyday bundle.
const ProfilePage = lazy(async () => ({
  default: (await import('@/features/account/ProfilePage')).ProfilePage,
}))
const SetupPage = lazy(async () => ({
  default: (await import('@/features/setup/SetupPage')).SetupPage,
}))
// Managers only, and not every day.
const TemperatureReviewPage = lazy(async () => ({
  default: (await import('@/features/temperatures/ReviewPage')).TemperatureReviewPage,
}))
import {
  AllTemperaturesPage,
  CookingTemperaturesPage,
  FreezerTemperaturesPage,
  FridgeTemperaturesPage,
  HotHoldingTemperaturesPage,
} from '@/features/temperatures/pages'

export function App() {
  const { ready, hasData } = useStore()

  // The first paint waits for the repository so pages never flash empty state.
  if (!ready) return <BootSplash firstLoad />

  return (
    <Routes>
      {/* Outside the shell: setup asks one thing at a time, with no nav to wander off into. */}
      <Route
        path="setup/*"
        element={
          <Suspense fallback={<BootSplash />}>
            <SetupPage />
          </Suspense>
        }
      />
      {/* Where QR labels land. Full screen for one-handed use, and outside the
          first-run redirect so a label scanned on the wrong device can say so. */}
      <Route path="scan/:itemId" element={<ScanPage />} />
      {/* A first run has nothing to show yet, so every page leads to setup. */}
      <Route element={hasData ? <AppShell /> : <Navigate to="/setup" replace />}>
        <Route index element={<TodayPage />} />
        <Route path="temperatures">
          <Route index element={<TempsPage />} />
          <Route path="records" element={<AllTemperaturesPage />} />
          <Route path="appliance/:id" element={<ApplianceDetailPage />} />
          <Route path="cooking" element={<CookingTemperaturesPage />} />
          <Route path="fridges" element={<FridgeTemperaturesPage />} />
          <Route path="freezers" element={<FreezerTemperaturesPage />} />
          <Route path="hot-holding" element={<HotHoldingTemperaturesPage />} />
          <Route
            path="labels"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <QrLabelsPage />
              </Suspense>
            }
          />
          <Route
            path="review"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <TemperatureReviewPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="food-probe" element={<FoodProbePage />} />
        <Route path="deliveries" element={<DeliveriesBoard />} />
        <Route path="deliveries/records" element={<DeliveriesPage />} />
        <Route path="deliveries/order/:id" element={<ExpectedDeliveryPage />} />
        <Route path="deliveries/received/:id" element={<ReceivedDeliveryPage />} />
        <Route path="suppliers" element={<SuppliersListPage />} />
        <Route path="suppliers/orders" element={<SuppliersPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="food-safety" element={<IssuesPage />} />
        <Route path="food-safety/:id" element={<IssueDetailPage />} />
        <Route path="checklists">
          <Route index element={<ChecklistsPage view="all" />} />
          <Route path="opening-closing" element={<ChecklistsPage view="opening-closing" />} />
          <Route path="cleaning" element={<ChecklistsPage view="cleaning" />} />
          <Route path="food-safety" element={<ChecklistsPage view="food-safety" />} />
        </Route>
        {/* Old addresses, kept so bookmarks on the kitchen tablet still land. */}
        <Route path="cleaning" element={<Navigate to="/checklists/cleaning" replace />} />
        <Route path="opening-closing" element={<Navigate to="/checklists/opening-closing" replace />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="stock/:id" element={<StockItemPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="team/:id" element={<StaffDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="calendar/shift/:id" element={<ShiftDetailPage />} />
        <Route path="calendar/hours" element={<HoursPage />} />
        <Route
          path="templates"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <TemplatesPage />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="reports/inspection"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <InspectionPackPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <SettingsHubPage />
            </Suspense>
          }
        />
        <Route
          path="settings/manage"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <SettingsPage />
            </Suspense>
          }
        />
        {[
          { path: 'account', page: <AccountVenuePage /> },
          { path: 'notifications', page: <NotificationSettingsPage /> },
          { path: 'device', page: <SharedDevicePage /> },
          { path: 'thresholds', page: <ThresholdsPage /> },
          { path: 'sync', page: <SyncPage /> },
          { path: 'help', page: <HelpPage /> },
        ].map(({ path, page }) => (
          <Route key={path} path={`settings/${path}`} element={<Suspense fallback={<PageSkeleton />}>{page}</Suspense>} />
        ))}
        <Route
          path="profile"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ProfilePage />
            </Suspense>
          }
        />
        <Route
          path="settings/templates/*"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <TemplateEditorRoutes />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-surface-muted h-9 w-64 animate-pulse rounded-lg" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-surface-muted h-24 animate-pulse rounded-card" />
        ))}
      </div>
      <div className="bg-surface-muted rounded-card h-80 animate-pulse" />
    </div>
  )
}

/** `firstLoad`: waiting on the repository, which on a device's very first run means the network. */
function BootSplash({ firstLoad = false }: { firstLoad?: boolean }) {
  const synced = useSync()
  // After its first load a device opens from its own copy, so only then is there anything to explain.
  const sync = firstLoad ? synced : null
  const waiting =
    sync?.status.state === 'offline'
      ? 'You’re offline. This device needs a connection once to download your venue, then it works without one.'
      : sync?.status.state === 'error'
        ? `Couldn’t reach your venue: ${sync.status.error}. Trying again…`
        : sync?.status.state === 'signed-out'
          ? 'This device was signed out before it finished downloading your venue.'
          : null

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="size-11 animate-pulse rounded-xl" />
        <p className="text-ink-muted text-sm">Loading your venue…</p>
        {waiting ? <p className="text-ink-muted max-w-xs px-4 text-center text-[13px]">{waiting}</p> : null}
        {/* Nothing is on this device yet, so there is nothing for signing out to lose. */}
        {sync?.status.state === 'signed-out' ? (
          <Button variant="primary" onClick={() => void sync.signOut()}>
            Sign in
          </Button>
        ) : null}
      </div>
    </div>
  )
}
