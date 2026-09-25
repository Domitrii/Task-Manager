import { useState, type ReactNode } from 'react'
import {
  AlarmClockOff,
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCheck,
  type LucideIcon,
  MapPin,
} from 'lucide-react'
import { CATEGORY_ICONS } from '@/config/navigation'
import { staffName, type TaskState, type TodayPeriod, type TodayTask } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatRange } from '@/lib/compliance'
import { formatTemp, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useQuickEntry } from '@/components/layout/quickEntry'

/**
 * Finished work folds away. A reading that was out of range stays in view; a
 * late check folds, since the window header already says it was missed.
 */
const FOLDS: TaskState[] = ['done', 'late']

/**
 * The trading day as a line: each check window is a stop on it, holding the
 * temperature checks and checklists that belong to that window.
 */
export function DayTimeline({ periods }: { periods: TodayPeriod[] }) {
  return (
    <ol aria-label="Today's checks">
      {periods.map((period, index) => (
        <PeriodBlock key={period.window.period} period={period} last={index === periods.length - 1} />
      ))}
    </ol>
  )
}

function PeriodBlock({ period, last }: { period: TodayPeriod; last: boolean }) {
  const { window, timing, tasks } = period
  const missed = tasks.filter((task) => task.state === 'missed').length
  const open = tasks.filter((task) => task.state === 'missed' || task.state === 'due').length
  const folded = tasks.filter((task) => FOLDS.includes(task.state))
  // In the open window a short done list is worth seeing; past windows fold it.
  const [showFolded, setShowFolded] = useState(timing === 'now' && folded.length <= 3)
  const [showLater, setShowLater] = useState(false)

  const visible =
    timing === 'later'
      ? showLater
        ? tasks
        : []
      : tasks.filter((task) => showFolded || !FOLDS.includes(task.state))

  return (
    <li className={cn('relative flex gap-3 sm:gap-4', !last && 'pb-8')}>
      <div className="relative flex w-7 shrink-0 justify-center" aria-hidden>
        <RailNode timing={timing} missed={missed} />
        {!last ? <span className="bg-line-default absolute top-9 -bottom-1 w-0.5 rounded-full" /> : null}
      </div>

      <section className="min-w-0 flex-1" aria-label={`${window.label}, ${window.startTime} to ${window.endTime}`}>
        <header className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-ink text-xl font-bold">{window.label}</h2>
          <span className="text-ink-muted tabular text-[15px]">
            {window.startTime}–{window.endTime}
          </span>
          <span className="ml-auto text-sm font-semibold">
            {timing === 'now' ? (
              <span className="bg-brand-600 rounded-full px-2.5 py-1 text-white">
                Open now{open > 0 ? `, ${open} to do` : ''}
              </span>
            ) : timing === 'past' ? (
              missed > 0 ? (
                <span className="text-fail-700 dark:text-fail-500">{missed} missed</span>
              ) : (
                <span className="text-pass-700 dark:text-pass-500 inline-flex items-center gap-1">
                  <Check className="size-4" strokeWidth={2.5} />
                  All done
                </span>
              )
            ) : (
              <span className="text-ink-muted font-medium">Opens at {window.startTime}</span>
            )}
          </span>
        </header>

        <div
          className={cn(
            'bg-surface border-line mt-3 overflow-hidden rounded-xl border',
            timing === 'now' && 'border-brand-500/40 shadow-raised',
          )}
        >
          {visible.length > 0 ? (
            <ul className="divide-line divide-y">
              {visible.map((task) => (
                <li key={task.key}>
                  <TaskRow task={task} />
                </li>
              ))}
            </ul>
          ) : null}

          {timing === 'later' ? (
            <FoldToggle
              divided={visible.length > 0}
              onClick={() => setShowLater((current) => !current)}
              label={showLater ? 'Hide' : `See the ${tasks.length} ${tasks.length === 1 ? 'check' : 'checks'} coming up`}
            />
          ) : folded.length > 0 ? (
            <FoldToggle
              divided={visible.length > 0}
              onClick={() => setShowFolded((current) => !current)}
              label={
                showFolded
                  ? 'Hide done'
                  : visible.length === 0
                    ? `All ${folded.length} done. Show them`
                    : `Show ${folded.length} done`
              }
              done={visible.length === 0 && !showFolded}
            />
          ) : null}
        </div>
      </section>
    </li>
  )
}

function RailNode({ timing, missed }: { timing: TodayPeriod['timing']; missed: number }) {
  if (timing === 'now') {
    return (
      <span className="bg-brand-600 ring-brand-100 dark:ring-brand-500/25 relative z-10 mt-0.5 flex size-7 items-center justify-center rounded-full ring-4">
        <span className="size-2.5 rounded-full bg-white" />
      </span>
    )
  }
  if (timing === 'past') {
    return missed > 0 ? (
      <span className="bg-fail-600 relative z-10 mt-0.5 flex size-7 items-center justify-center rounded-full text-white">
        <AlarmClockOff className="size-4" strokeWidth={2.4} />
      </span>
    ) : (
      <span className="bg-pass-600 relative z-10 mt-0.5 flex size-7 items-center justify-center rounded-full text-white">
        <Check className="size-4" strokeWidth={3} />
      </span>
    )
  }
  return <span className="border-line-strong bg-app relative z-10 mt-0.5 size-7 rounded-full border-2" />
}

function FoldToggle({
  label,
  onClick,
  divided,
  done,
}: {
  label: string
  onClick: () => void
  divided: boolean
  done?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-surface-muted/70 flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-semibold transition-colors',
        divided && 'border-line border-t',
        done ? 'text-pass-700 dark:text-pass-500' : 'text-brand-700 dark:text-brand-300',
      )}
    >
      {done ? <Check className="size-4" strokeWidth={2.5} /> : null}
      {label}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

const LEAD: Record<TaskState, string> = {
  due: 'border-2 border-brand-500 text-brand-600 dark:text-brand-300',
  upcoming: 'border-2 border-dashed border-line-strong text-ink-subtle',
  missed: 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500',
  failed: 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500',
  late: 'bg-warn-50 text-warn-700 dark:bg-warn-500/12 dark:text-warn-500',
  done: 'bg-pass-50 text-pass-600 dark:bg-pass-500/12 dark:text-pass-500',
}

/** States that swap the item's own icon for a verdict. */
const VERDICT_ICON: Partial<Record<TaskState, LucideIcon>> = {
  missed: AlarmClockOff,
  failed: AlertTriangle,
  late: Check,
  done: Check,
}

function TaskRow({ task }: { task: TodayTask }) {
  const { data } = useStore()
  const quickEntry = useQuickEntry()

  let title: string
  let detail: ReactNode
  let trailing: ReactNode = null
  let action: (() => void) | undefined
  let kindIcon: LucideIcon

  if (task.kind === 'temperature') {
    const { item, log, window } = task.slot
    title = item.name
    kindIcon = CATEGORY_ICONS[item.category]
    const record = () => quickEntry.recordTemperature({ itemId: item.id })

    switch (task.state) {
      case 'due':
        detail = <Where range={formatRange(item)} location={item.location} />
        trailing = <ActionPill>Log</ActionPill>
        action = record
        break
      case 'missed':
        detail = <span className="text-fail-700 dark:text-fail-500">Missed. Window closed at {window.endTime}</span>
        trailing = <ActionPill>Log</ActionPill>
        action = record
        break
      case 'late':
        detail = `Missed, then checked at ${formatTime(task.followUp!.recordedAt)}`
        trailing = <Reading value={task.followUp!.temperature} />
        break
      case 'failed':
        detail = (
          <span className="text-fail-700 dark:text-fail-500">
            Out of range at {formatTime(log!.recordedAt)}
            {log!.correctiveAction ? `. ${log!.correctiveAction}` : ''}
          </span>
        )
        trailing = <Reading value={log!.temperature} fail />
        break
      case 'done':
        detail = `${formatTime(log!.recordedAt)} by ${staffName(data, log!.recordedBy)}`
        trailing = <Reading value={log!.temperature} />
        break
      default:
        detail = <Where range={formatRange(item)} location={item.location} />
    }
  } else {
    const { template, run, failedCount } = task.checklist
    title = template.name
    kindIcon = ClipboardCheck
    const open = () => quickEntry.openChecklist(template.id)
    const size = `${template.items.length} checks${template.area ? `, ${template.area}` : ''}`

    switch (task.state) {
      case 'due':
        detail = size
        trailing = <ActionPill>Start</ActionPill>
        action = open
        break
      case 'missed':
        detail = <span className="text-fail-700 dark:text-fail-500">Missed. You can still do it now</span>
        trailing = <ActionPill>Start</ActionPill>
        action = open
        break
      case 'failed':
        detail = (
          <span className="text-fail-700 dark:text-fail-500">
            {failedCount} {failedCount === 1 ? 'item' : 'items'} failed. Signed off by {staffName(data, run?.completedBy)}
          </span>
        )
        trailing = <ChevronRight className="text-ink-subtle size-5 shrink-0" />
        action = open
        break
      case 'done':
        detail = `Signed off at ${formatTime(run!.completedAt)} by ${staffName(data, run?.completedBy)}`
        trailing = <ChevronRight className="text-ink-subtle size-5 shrink-0" />
        action = open
        break
      default:
        detail = size
    }
  }

  const Lead = VERDICT_ICON[task.state] ?? kindIcon
  const content = (
    <>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', LEAD[task.state])}>
        <Lead className="size-[18px]" strokeWidth={task.state === 'done' || task.state === 'late' ? 2.8 : 2} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'line-clamp-2 block text-base leading-snug font-semibold',
            task.state === 'upcoming' ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {title}
        </span>
        <span className="text-ink-muted line-clamp-2 text-sm">{detail}</span>
      </span>
      {trailing}
    </>
  )

  const className = 'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left'
  return action ? (
    <button type="button" onClick={action} className={cn(className, 'hover:bg-surface-muted/60 transition-colors')}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** Range first; the location gets a pin so "Pass" reads as a place, not a verdict. */
function Where({ range, location }: { range: string; location: string }) {
  return (
    <span className="flex flex-wrap gap-x-3">
      <span>{range}</span>
      <span className="inline-flex items-center gap-1">
        <MapPin className="size-3.5 shrink-0" aria-label="Location" />
        {location}
      </span>
    </span>
  )
}

function ActionPill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-brand-600 flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-white">
      {children}
    </span>
  )
}

function Reading({ value, fail }: { value: number; fail?: boolean }) {
  return (
    <span
      className={cn(
        'tabular shrink-0 text-base font-bold',
        fail ? 'text-fail-700 dark:text-fail-500' : 'text-ink',
      )}
    >
      {formatTemp(value)}
    </span>
  )
}
