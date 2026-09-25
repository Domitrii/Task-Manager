import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useStore } from '@/data/store'
import { selectOpenIssues, selectOverdueTasks, selectRejectedDeliveries, selectToday } from '@/data/selectors'
import type { ID } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { useNow } from '@/lib/useNow'
import { ChecklistRunModal } from '@/features/checklists/ChecklistRunModal'
import { RaiseIssueModal } from '@/features/checklists/FoodSafetyPage'
import { DeliveryFormModal } from '@/features/deliveries/DeliveryFormModal'
import { NewTaskModal } from '@/features/tasks/TasksPage'
import { RecordTemperatureModal } from '@/features/temperatures/RecordTemperatureModal'
import { BottomNav, MoreSheet } from './BottomNav'
import { CommandPalette } from './CommandPalette'
import { LogSheet } from './LogSheet'
import { QuickEntryContext, type QuickEntryApi, type TemperatureEntryOptions } from './quickEntry'
import { Sidebar, type NavCounters } from './Sidebar'
import { Topbar } from './Topbar'

/** Only one sheet is ever open, so choosing from one simply replaces it. */
type Sheet =
  | { type: 'log' }
  | { type: 'more' }
  | { type: 'search' }
  | { type: 'temperature'; options: TemperatureEntryOptions }
  | { type: 'delivery' }
  | { type: 'checklist'; templateId: ID }
  | { type: 'issue' }
  | { type: 'task' }

export function AppShell() {
  const now = useNow()
  const { data } = useStore()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = useCallback(() => setSheet(null), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSheet((current) => (current?.type === 'search' ? null : { type: 'search' }))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const counters = useMemo<NavCounters>(() => {
    const today = selectToday(data, now)
    return {
      today: { value: today.missed + today.due, tone: today.missed > 0 ? 'fail' : 'warn' },
      openIssues: { value: selectOpenIssues(data).length, tone: 'fail' },
      openTasks: { value: selectOverdueTasks(data, now).length, tone: 'warn' },
      rejectedDeliveries: { value: selectRejectedDeliveries(data, 7, now).length, tone: 'warn' },
    }
  }, [data, now])

  const api = useMemo<QuickEntryApi>(
    () => ({
      openLog: () => setSheet({ type: 'log' }),
      recordTemperature: (options = {}) => setSheet({ type: 'temperature', options }),
      recordDelivery: () => setSheet({ type: 'delivery' }),
      openChecklist: (templateId) => setSheet({ type: 'checklist', templateId }),
      raiseIssue: () => setSheet({ type: 'issue' }),
      addTask: () => setSheet({ type: 'task' }),
    }),
    [],
  )

  return (
    <QuickEntryContext value={api}>
      <div className="flex min-h-full">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="fixed inset-y-0 left-0 w-60">
            <Sidebar counters={counters} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenSearch={() => setSheet({ type: 'search' })} onOpenLog={api.openLog} />
          <main className="min-w-0 flex-1 px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-4 lg:pb-12">
            <div className="mx-auto max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <BottomNav counters={counters} onOpenLog={api.openLog} onOpenMore={() => setSheet({ type: 'more' })} />

      {sheet?.type === 'log' ? <LogSheet api={api} onClose={close} /> : null}
      {sheet?.type === 'more' ? <MoreSheet counters={counters} onClose={close} /> : null}
      {sheet?.type === 'search' ? <CommandPalette api={api} onClose={close} /> : null}
      {sheet?.type === 'temperature' ? (
        <RecordTemperatureModal
          open
          onClose={close}
          defaultItemId={sheet.options.itemId}
          restrictTo={sheet.options.restrictTo}
        />
      ) : null}
      {sheet?.type === 'delivery' ? <DeliveryFormModal open onClose={close} /> : null}
      {sheet?.type === 'checklist' ? <ChecklistSheet templateId={sheet.templateId} onClose={close} /> : null}
      {sheet?.type === 'issue' ? <RaiseIssueModal open onClose={close} /> : null}
      {sheet?.type === 'task' ? <NewTaskModal open onClose={close} /> : null}
    </QuickEntryContext>
  )
}

/** Today's run of a checklist — a fresh one to fill in, or the signed-off record. */
function ChecklistSheet({ templateId, onClose }: { templateId: ID; onClose: () => void }) {
  const { data } = useStore()
  const template = data.checklistTemplates.find((entry) => entry.id === templateId)
  // Frozen at open, so signing off doesn't flip the sheet to read-only mid-save.
  const [existing] = useState(() =>
    data.checklistRuns.find((run) => run.templateId === templateId && run.date === toISODate(new Date())),
  )
  return <ChecklistRunModal template={template} existing={existing} onClose={onClose} />
}
