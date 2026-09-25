import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useStore } from '@/data/store'
import { DeliveriesPage } from '@/features/deliveries/DeliveriesPage'
import { FoodSafetyPage } from '@/features/checklists/FoodSafetyPage'
import { ChecklistsPage } from '@/features/checklists/pages'
import { StockPage } from '@/features/stock/StockPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { ScanPage } from '@/features/qr/ScanPage'
import { TodayPage } from '@/features/today/TodayPage'

// Reports and Settings are visited far less than the daily-entry screens, so
// they load on demand rather than adding to the first paint on the pass.
const ReportsPage = lazy(async () => ({
  default: (await import('@/features/reports/ReportsPage')).ReportsPage,
}))
const SettingsPage = lazy(async () => ({
  default: (await import('@/features/settings/SettingsPage')).SettingsPage,
}))
const QrLabelsPage = lazy(async () => ({
  default: (await import('@/features/qr/QrLabelsPage')).QrLabelsPage,
}))
// Setup runs once per venue, so its packs stay out of the everyday bundle.
const SetupPage = lazy(async () => ({
  default: (await import('@/features/setup/SetupPage')).SetupPage,
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
  if (!ready) return <BootSplash />

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
          <Route index element={<AllTemperaturesPage />} />
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
        </Route>
        <Route path="deliveries" element={<DeliveriesPage />} />
        <Route path="food-safety" element={<FoodSafetyPage />} />
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
        <Route path="tasks" element={<TasksPage />} />
        <Route
          path="reports"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <SettingsPage />
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

function BootSplash() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="bg-brand-600 flex size-11 animate-pulse items-center justify-center rounded-xl">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
            <path
              d="M7 3v8a2 2 0 0 0 2 2v8a1.2 1.2 0 0 0 2.4 0v-8a2 2 0 0 0 2-2V3"
              stroke="#d5eff2"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path d="M17.4 3c1.5 1.2 1.8 4.3 0 5.8V21" stroke="#7bcad6" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-ink-muted text-sm">Loading your venue…</p>
      </div>
    </div>
  )
}
