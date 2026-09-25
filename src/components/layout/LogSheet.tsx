import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Flame,
  ListChecks,
  type LucideIcon,
  Package,
  ShieldAlert,
  Thermometer,
} from 'lucide-react'
import { selectActionableReadings, selectChecklistStatus, staffName, type ChecklistStatus } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatTime } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { QuickEntryApi } from './quickEntry'

interface Choice {
  label: string
  description: string
  icon: LucideIcon
  run: () => void
}

const CHECKLIST_ORDER: Record<ChecklistStatus['state'], number> = {
  overdue: 0,
  due: 1,
  upcoming: 2,
  issues: 3,
  complete: 4,
}

/** The one place to add anything. Opened by the Log button on every page. */
export function LogSheet({ api, onClose }: { api: QuickEntryApi; onClose: () => void }) {
  const now = useNow()
  const { data } = useStore()
  const [step, setStep] = useState<'menu' | 'checklist'>('menu')

  const dueReadings = useMemo(() => selectActionableReadings(data, now), [data, now])
  const checklists = useMemo(
    () =>
      selectChecklistStatus(data, now).sort(
        (a, b) => CHECKLIST_ORDER[a.state] - CHECKLIST_ORDER[b.state] || a.template.name.localeCompare(b.template.name),
      ),
    [data, now],
  )

  const choices: Choice[] = [
    {
      label: 'Temperature',
      description: 'Fridge, freezer or hot holding',
      icon: Thermometer,
      run: () => api.recordTemperature({ restrictTo: ['fridge', 'freezer', 'display_fridge', 'hot_holding'] }),
    },
    {
      label: 'Food probe',
      description: 'Cooking, reheating or cooling',
      icon: Flame,
      run: () => api.recordTemperature({ restrictTo: ['cooking', 'cooling'] }),
    },
    {
      label: 'Checklist',
      description: 'Opening, closing or cleaning',
      icon: ClipboardCheck,
      run: () => setStep('checklist'),
    },
    { label: 'Delivery', description: 'Goods in, with temperatures', icon: Package, run: api.recordDelivery },
    { label: 'Issue', description: 'A problem that needs fixing', icon: ShieldAlert, run: api.raiseIssue },
    { label: 'Task', description: 'A job for someone on the team', icon: ListChecks, run: api.addTask },
  ]

  if (step === 'checklist') {
    return (
      <Modal open onClose={onClose} title="Which checklist?" description="Today's checklists, most urgent first.">
        <button
          type="button"
          onClick={() => setStep('menu')}
          className="text-ink-muted hover:text-ink -mt-1 mb-3 -ml-1 inline-flex items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>
        <ul className="space-y-2">
          {checklists.map((entry) => (
            <li key={entry.template.id}>
              <button
                type="button"
                onClick={() => api.openChecklist(entry.template.id)}
                className="border-line hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/8 flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
              >
                <ClipboardCheck className="text-ink-subtle size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-[15px] font-semibold">{entry.template.name}</span>
                  <span className="text-ink-muted block truncate text-[13px]">
                    {entry.run
                      ? `Signed off at ${formatTime(entry.run.completedAt)} by ${staffName(data, entry.run.completedBy)}`
                      : `${entry.template.items.length} checks`}
                  </span>
                </span>
                <ChecklistStateBadge state={entry.state} failed={entry.failedCount} />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="What are you logging?">
      {dueReadings.length > 0 ? (
        <button
          type="button"
          onClick={() => api.recordTemperature({ itemId: dueReadings[0].item.id })}
          className="bg-brand-600 hover:bg-brand-700 mb-4 flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-white transition-colors"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Thermometer className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Start temperature checks</span>
            <span className="text-brand-100 block text-[13px]">
              {dueReadings.length} {dueReadings.length === 1 ? 'check needs' : 'checks need'} doing now. We'll take
              you through them one by one.
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 opacity-80" />
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {choices.map((choice) => {
          const Icon = choice.icon
          return (
            <button
              key={choice.label}
              type="button"
              onClick={choice.run}
              className="border-line bg-surface hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/8 flex min-h-32 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors"
            >
              <span className="bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300 flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="text-ink block text-[15px] font-semibold">{choice.label}</span>
                <span className="text-ink-muted mt-0.5 block text-[13px] leading-snug">{choice.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

function ChecklistStateBadge({ state, failed }: { state: ChecklistStatus['state']; failed: number }) {
  const className = 'shrink-0'
  if (state === 'complete') return <Badge tone="pass" className={className}>Done</Badge>
  if (state === 'issues') return <Badge tone="warn" className={className}>{failed} failed</Badge>
  if (state === 'overdue') return <Badge tone="fail" className={className}>Missed</Badge>
  if (state === 'due') return <Badge tone="warn" className={className}>Due now</Badge>
  return <Badge tone="neutral" className={className}>Later</Badge>
}
