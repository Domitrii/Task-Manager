import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import {
  DAY_WORK_KINDS,
  selectDayProgress,
  staffMember,
  type DayProgress,
  type DayWorkKind,
} from '@/data/selectors'
import { useStore } from '@/data/store'
import { useNow } from '@/lib/useNow'
import { cn, percent } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { avatarFill } from '@/components/ui/avatarColors'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

const KINDS: Record<DayWorkKind, { one: string; many: string; to: string; late: string }> = {
  check: { one: 'temperature check', many: 'temperature checks', to: '/', late: 'missed' },
  checklist: { one: 'checklist', many: 'checklists', to: '/checklists', late: 'missed' },
  task: { one: 'task', many: 'tasks', to: '/tasks', late: 'overdue' },
  delivery: { one: 'delivery to check in', many: 'deliveries to check in', to: '/deliveries', late: 'overdue' },
}

const describe = (count: number, kind: DayWorkKind) => `${count} ${count === 1 ? KINDS[kind].one : KINDS[kind].many}`

/**
 * Today's whole list as one bar across the top of every page. What's done is
 * coloured by who did it, in their avatar colour, biggest share first, so
 * everyone can see how the day is going and who's been putting it in.
 */
export function DayProgressBar() {
  const now = useNow()
  const { data } = useStore()
  const progress = useMemo(() => selectDayProgress(data, now), [data, now])
  const [open, setOpen] = useState(false)

  if (progress.total === 0) return null

  const shares = progress.contributors
    .map((person) => `${staffMember(data, person.staffId)?.name ?? 'Not recorded'} ${person.count}`)
    .join(', ')
  const leaders = progress.contributors.filter((person) => person.staffId !== undefined).slice(0, 3)

  return (
    <>
      <div className="px-2 pb-1.5 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Today: ${progress.done} of ${progress.total} done${shares ? ` (${shares})` : ''}. Show who did what`}
          className="hover:bg-surface-muted/70 flex w-full items-center gap-3 rounded-lg px-2 py-1 transition-colors"
        >
          <span className="text-ink-muted shrink-0 text-xs">
            <span className="text-ink tabular font-semibold">{progress.done}</span>/{progress.total}
            <span className="hidden sm:inline"> done today</span>
          </span>
          <Segments progress={progress} className="h-2 flex-1" seam="border-app" />
          {leaders.length > 0 ? (
            <span className="hidden shrink-0 -space-x-1.5 sm:flex" aria-hidden>
              {leaders.map((person) => (
                <Avatar
                  key={person.staffId}
                  person={staffMember(data, person.staffId)}
                  size="xs"
                  className="ring-2 ring-[var(--app-bg)]"
                />
              ))}
            </span>
          ) : null}
        </button>
      </div>
      {open ? <DayProgressSheet progress={progress} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

/** One fill per person, in their avatar colour, on a track for what's still to do. */
function Segments({ progress, className, seam }: { progress: DayProgress; className?: string; seam: string }) {
  const { staffColors } = useStore()
  return (
    <span className={cn('bg-line-default flex min-w-0 overflow-hidden rounded-full', className)} aria-hidden>
      {progress.contributors.map((person) => (
        <span
          key={person.staffId ?? 'unknown'}
          // A 2px seam in the background colour keeps neighbours apart, even two people of the same colour.
          className={cn(
            'h-full border-r-2 transition-[width] duration-500',
            seam,
            avatarFill(person.staffId ? staffColors.get(person.staffId) : undefined),
          )}
          style={{ width: `${(person.count / progress.total) * 100}%` }}
        />
      ))}
    </span>
  )
}

function DayProgressSheet({ progress, onClose }: { progress: DayProgress; onClose: () => void }) {
  const { data, staffColors } = useStore()
  const left = progress.total - progress.done

  return (
    <Modal
      open
      onClose={onClose}
      title="Today’s progress"
      description={`${progress.done} of ${progress.total} done · ${percent(progress.done, progress.total)}%`}
    >
      <div className="space-y-5">
        <Segments progress={progress} className="h-3" seam="border-surface" />

        <section aria-labelledby="progress-people">
          <h3 id="progress-people" className="text-ink text-sm font-semibold">
            Who did what
          </h3>
          {progress.contributors.length === 0 ? (
            <p className="text-ink-muted mt-1 text-[13px]">Nothing on today’s list is done yet.</p>
          ) : (
            <ul className="divide-line mt-1 divide-y">
              {progress.contributors.map((person) => {
                const member = staffMember(data, person.staffId)
                return (
                  <li key={person.staffId ?? 'unknown'} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        avatarFill(person.staffId ? staffColors.get(person.staffId) : undefined),
                      )}
                      aria-hidden
                    />
                    <Avatar person={member} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-sm font-medium">{member?.name ?? 'Not recorded'}</p>
                      <p className="text-ink-muted text-xs">
                        {DAY_WORK_KINDS.filter((kind) => person.byKind[kind] > 0)
                          .map((kind) => describe(person.byKind[kind], kind).replace(' to check in', ''))
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="text-right">
                      <span className="tabular text-ink block text-sm font-semibold">{person.count}</span>
                      <span className="tabular text-ink-subtle block text-[11px]">
                        {percent(person.count, progress.done)}%
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="progress-left">
          <h3 id="progress-left" className="text-ink text-sm font-semibold">
            Still to do <span className="text-ink-muted font-normal">({left})</span>
          </h3>
          {left === 0 ? (
            <p className="text-pass-700 dark:text-pass-500 mt-1 text-[13px]">Everything on today’s list is done.</p>
          ) : (
            <ul className="mt-1">
              {DAY_WORK_KINDS.filter((kind) => progress.left[kind].count > 0).map((kind) => (
                <li key={kind}>
                  <Link
                    to={KINDS[kind].to}
                    onClick={onClose}
                    className="hover:bg-surface-muted/70 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
                  >
                    <span className="text-ink min-w-0 flex-1 text-sm">{describe(progress.left[kind].count, kind)}</span>
                    {progress.left[kind].late > 0 ? (
                      <Badge tone="fail">
                        {progress.left[kind].late} {KINDS[kind].late}
                      </Badge>
                    ) : null}
                    <ChevronRight className="text-ink-subtle size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-ink-subtle text-xs">
          Counts today’s scheduled temperature checks and checklists (later ones too), tasks due today or overdue, and
          orders due to be checked in. Each one done is credited to whoever entered it.
        </p>
      </div>
    </Modal>
  )
}
