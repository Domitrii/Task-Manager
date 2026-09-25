import { AlarmClockOff, Check, Clock, Moon, type LucideIcon } from 'lucide-react'
import { isActionable, type TodayOverview, type TodayTask } from '@/data/selectors'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useQuickEntry } from '@/components/layout/quickEntry'

type Tone = 'fail' | 'warn' | 'pass' | 'neutral'

const TONE_ICON: Record<Tone, { icon: LucideIcon; className: string }> = {
  fail: { icon: AlarmClockOff, className: 'bg-fail-50 text-fail-600 dark:bg-fail-500/12 dark:text-fail-500' },
  warn: { icon: Clock, className: 'bg-warn-50 text-warn-700 dark:bg-warn-500/12 dark:text-warn-500' },
  pass: { icon: Check, className: 'bg-pass-50 text-pass-600 dark:bg-pass-500/12 dark:text-pass-500' },
  neutral: { icon: Moon, className: 'bg-surface-muted text-ink-muted' },
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/** Says, in words, what the day needs from the person holding the tablet. */
function describe(today: TodayOverview, failedReadings: number): { tone: Tone; headline: string; detail: string } {
  const { missed, due, done, total, current, next } = today

  if (total === 0) {
    return {
      tone: 'neutral',
      headline: 'Nothing scheduled today',
      detail: 'Add equipment and check times in Settings to build your daily list.',
    }
  }
  if (missed > 0) {
    const more = due > 0 ? ` ${due} more ${plural(due, 'is', 'are')} due by ${current?.window.endTime}.` : ''
    return {
      tone: 'fail',
      headline: `${missed} ${plural(missed, 'check', 'checks')} missed`,
      detail: `Do ${plural(missed, 'it', 'them')} now and add a note saying why ${plural(missed, 'it was', 'they were')} late.${more}`,
    }
  }
  if (due > 0) {
    return {
      tone: 'warn',
      headline: `${due} ${plural(due, 'check', 'checks')} due by ${current?.window.endTime}`,
      detail: `${current?.window.label} checks are open now. ${done} of ${total} done today.`,
    }
  }
  if (next) {
    if (done === 0) {
      return {
        tone: 'neutral',
        headline: 'Nothing due yet',
        detail: `${next.window.label} checks open at ${next.window.startTime}.`,
      }
    }
    return {
      tone: 'pass',
      headline: "You're up to date",
      detail: `${next.window.label} checks open at ${next.window.startTime}. ${done} of ${total} done so far.`,
    }
  }
  return {
    tone: 'pass',
    headline: 'Every check is done for today',
    detail:
      failedReadings > 0
        ? `${failedReadings} ${plural(failedReadings, 'reading was', 'readings were')} out of range, each with an action recorded.`
        : `All ${total} are on the record.`,
  }
}

export function DayStatus({
  today,
  greeting,
  dateLabel,
  failedReadings,
}: {
  today: TodayOverview
  greeting: string
  dateLabel: string
  failedReadings: number
}) {
  const quickEntry = useQuickEntry()
  const { tone, headline, detail } = describe(today, failedReadings)
  const { icon: Icon, className } = TONE_ICON[tone]

  const actionable = today.periods.flatMap((period) => period.tasks).filter(isActionable)
  // One reading clears every open slot for an item, so count items, not slots.
  const readings = new Set(actionable.flatMap((task) => (task.kind === 'temperature' ? [task.slot.item.id] : []))).size
  const first: TodayTask | undefined = actionable[0]

  return (
    <section aria-labelledby="day-status">
      <p className="text-ink-muted flex flex-wrap justify-between gap-x-4 text-[15px]">
        <span>{greeting}</span>
        <span>{dateLabel}</span>
      </p>

      <div className="mt-3 flex items-start gap-3.5 sm:gap-4">
        <span className={cn('mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full sm:size-12', className)}>
          <Icon className="size-5 sm:size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h1 id="day-status" className="text-ink text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">
            {headline}
          </h1>
          <p className="text-ink-muted mt-1.5 max-w-[60ch] text-base leading-relaxed sm:text-[17px]">{detail}</p>
        </div>
      </div>

      {first ? (
        <div className="mt-5 sm:pl-16">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() =>
              first.kind === 'temperature'
                ? quickEntry.recordTemperature({ itemId: first.slot.item.id })
                : quickEntry.openChecklist(first.checklist.template.id)
            }
          >
            {first.kind === 'temperature'
              ? `Start ${readings === 1 ? 'the check' : `${readings} checks`}`
              : `Start ${first.checklist.template.name}`}
          </Button>
        </div>
      ) : null}

      <DayMeter today={today} />
    </section>
  )
}

/**
 * Where the day stands, as one bar. Fills sit on a neutral track in the order
 * the day happens — done, missed, open now — with the rest still to come.
 */
function DayMeter({ today }: { today: TodayOverview }) {
  if (today.total === 0) return null
  const parts = [
    { key: 'done', value: today.done, label: 'done', fill: 'bg-pass-500' },
    { key: 'missed', value: today.missed, label: 'missed', fill: 'bg-fail-500' },
    { key: 'due', value: today.due, label: 'due now', fill: 'bg-warn-500' },
  ].filter((part) => part.value > 0)

  return (
    <div className="mt-6">
      <div
        role="img"
        aria-label={`${today.done} of ${today.total} done, ${today.missed} missed, ${today.due} due now, ${today.upcoming} later`}
        className="bg-line-default flex h-3 overflow-hidden rounded-full"
      >
        {/* A 2px page-coloured seam keeps neighbouring fills apart. */}
        {parts.map((part) => (
          <span
            key={part.key}
            className={cn('border-app h-full border-r-2 last:border-r-0', part.fill)}
            style={{ width: `${(part.value / today.total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="text-ink-muted mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', part.fill)} aria-hidden />
            <span className="text-ink font-semibold">{part.value}</span> {part.label}
          </li>
        ))}
        {today.upcoming > 0 ? (
          <li className="flex items-center gap-1.5">
            <span className="border-line-strong size-2.5 rounded-sm border" aria-hidden />
            <span className="text-ink font-semibold">{today.upcoming}</span> later today
          </li>
        ) : null}
      </ul>
    </div>
  )
}
