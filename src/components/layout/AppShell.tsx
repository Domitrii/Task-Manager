import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useStore } from '@/data/store'
import {
  selectOpenIssues,
  selectOutstandingTasks,
  selectRejectedDeliveries,
  selectTodaySlots,
} from '@/data/selectors'
import type { MonitoredCategory } from '@/data/types'
import { useNow } from '@/lib/useNow'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { DeliveryFormModal } from '@/features/deliveries/DeliveryFormModal'
import { RecordTemperatureModal } from '@/features/temperatures/RecordTemperatureModal'
import { CommandPalette } from './CommandPalette'
import { SidebarContent, type SidebarCounters } from './Sidebar'
import { Topbar } from './Topbar'

interface QuickEntryApi {
  recordTemperature: (options?: { itemId?: string; restrictTo?: MonitoredCategory[] }) => void
  recordDelivery: () => void
}

const QuickEntryContext = createContext<QuickEntryApi | null>(null)

/** Lets any page open the shared entry workflows without prop drilling. */
export function useQuickEntry(): QuickEntryApi {
  const context = use(QuickEntryContext)
  if (!context) throw new Error('useQuickEntry must be used inside <AppShell>')
  return context
}

export function AppShell() {
  const now = useNow()
  const { data } = useStore()
  const { theme, toggle } = useTheme()

  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [tempOpen, setTempOpen] = useState(false)
  const [tempOptions, setTempOptions] = useState<{ itemId?: string; restrictTo?: MonitoredCategory[] }>({})
  const [deliveryOpen, setDeliveryOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((current) => !current)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const counters = useMemo<SidebarCounters>(() => {
    const slots = selectTodaySlots(data, now)
    return {
      overdueChecks: slots.filter((slot) => slot.state === 'overdue').length,
      openIssues: selectOpenIssues(data).length,
      openTasks: selectOutstandingTasks(data).length,
      rejectedDeliveries: selectRejectedDeliveries(data, 7, now).length,
    }
  }, [data, now])

  const quickEntry = useMemo<QuickEntryApi>(
    () => ({
      recordTemperature: (options = {}) => {
        setTempOptions(options)
        setTempOpen(true)
      },
      recordDelivery: () => setDeliveryOpen(true),
    }),
    [],
  )

  const openTemperature = useCallback(() => quickEntry.recordTemperature(), [quickEntry])
  const openDelivery = useCallback(() => quickEntry.recordDelivery(), [quickEntry])

  return (
    <QuickEntryContext value={quickEntry}>
      <div className="flex h-full">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="fixed inset-y-0 left-0 w-64">
            <SidebarContent counters={counters} onNavigate={() => setNavOpen(false)} />
          </div>
        </aside>

        {/* Mobile drawer */}
        <div
          className={cn(
            'fixed inset-0 z-50 lg:hidden',
            navOpen ? 'pointer-events-auto' : 'pointer-events-none',
          )}
        >
          <div
            className={cn(
              'absolute inset-0 bg-slate-950/50 transition-opacity',
              navOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-[17rem] transition-transform duration-200',
              navOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <SidebarContent
              counters={counters}
              onNavigate={() => setNavOpen(false)}
              onClose={() => setNavOpen(false)}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onOpenNav={() => setNavOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onRecordTemperature={openTemperature}
            onRecordDelivery={openDelivery}
            theme={theme}
            onToggleTheme={toggle}
          />
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {tempOpen ? (
        <RecordTemperatureModal
          open
          onClose={() => setTempOpen(false)}
          defaultItemId={tempOptions.itemId}
          restrictTo={tempOptions.restrictTo}
        />
      ) : null}
      {deliveryOpen ? <DeliveryFormModal open onClose={() => setDeliveryOpen(false)} /> : null}
      {searchOpen ? (
        <CommandPalette
          onClose={() => setSearchOpen(false)}
          onRecordTemperature={openTemperature}
          onRecordDelivery={openDelivery}
        />
      ) : null}
    </QuickEntryContext>
  )
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>
}
