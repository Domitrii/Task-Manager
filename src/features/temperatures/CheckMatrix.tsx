import { Fragment } from 'react'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/config/navigation'
import { useStore } from '@/data/store'
import type { MonitoredItem } from '@/data/types'
import { formatRange, type CheckSlot } from '@/lib/compliance'
import { formatTemp, formatTime } from '@/lib/format'
import { cn, groupBy } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShowQrButton } from '@/features/qr/ShowQrButton'

/**
 * The daily temperature log sheet: one row per item, one column per scheduled
 * period. It mirrors the paper sheet it replaces, which is what makes it
 * scannable — a manager can see a whole day in one glance.
 */
export function CheckMatrix({
  slots,
  onRecord,
}: {
  slots: CheckSlot[]
  onRecord: (item: MonitoredItem) => void
}) {
  const { data } = useStore()

  if (slots.length === 0) {
    return (
      <EmptyState
        title="No scheduled checks"
        description="Items in this section are probed as needed rather than on a timetable."
      />
    )
  }

  const periods = data.settings.periods.filter((window) =>
    slots.some((slot) => slot.period === window.period),
  )
  const byItem = groupBy(slots, (slot) => slot.item.id)
  const items = Object.values(byItem).map((group) => group[0].item)
  const grouped = groupBy(items, (item) => item.category)

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="border-line text-ink-muted sticky left-0 z-10 border-b px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase"
            >
              Equipment
            </th>
            {periods.map((window) => (
              <th
                key={window.period}
                scope="col"
                className="border-line text-ink-muted border-b px-3 py-2.5 text-center text-xs font-semibold tracking-wide uppercase"
              >
                {window.label}
                <span className="text-ink-subtle block text-[10px] font-normal normal-case">
                  {window.startTime}–{window.endTime}
                </span>
              </th>
            ))}
            <th className="border-line border-b px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([category, categoryItems]) => {
            const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]
            return (
              <Fragment key={category}>
                {Object.keys(grouped).length > 1 ? (
                  <tr>
                    <td
                      colSpan={periods.length + 2}
                      className="bg-surface-muted/70 text-ink-muted border-line border-b px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="size-3.5" />
                        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                      </span>
                    </td>
                  </tr>
                ) : null}
                {categoryItems.map((item) => (
                  <tr key={item.id} className="last:[&>td]:border-b-0">
                    <td className="border-line border-b px-4 py-2.5">
                      <p className="text-ink text-[13px] font-medium">{item.name}</p>
                      <p className="text-ink-subtle text-[11px]">
                        {item.location} · {formatRange(item)}
                      </p>
                    </td>
                    {periods.map((window) => {
                      const slot = byItem[item.id]?.find((entry) => entry.period === window.period)
                      return (
                        <td key={window.period} className="border-line border-b px-2 py-2 text-center">
                          {slot ? <SlotCell slot={slot} /> : <span className="text-ink-subtle">—</span>}
                        </td>
                      )
                    })}
                    <td className="border-line border-b px-3 py-2 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <ShowQrButton item={item} />
                        <Button size="sm" onClick={() => onRecord(item)}>
                          Log
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SlotCell({ slot }: { slot: CheckSlot }) {
  const { data } = useStore()

  if (slot.log) {
    const person = data.staff.find((entry) => entry.id === slot.log?.recordedBy)
    const failed = slot.log.outcome === 'fail'
    return (
      <div
        className={cn(
          'mx-auto inline-flex min-w-[88px] flex-col items-center rounded-lg border px-2 py-1.5',
          failed
            ? 'border-fail-500/35 bg-fail-50 dark:bg-fail-500/10'
            : 'border-pass-500/30 bg-pass-50 dark:bg-pass-500/10',
        )}
        title={`${formatTemp(slot.log.temperature)} at ${formatTime(slot.log.recordedAt)}`}
      >
        <span
          className={cn(
            'tabular text-[15px] leading-5 font-semibold',
            failed ? 'text-fail-700 dark:text-fail-500' : 'text-pass-700 dark:text-pass-500',
          )}
        >
          {formatTemp(slot.log.temperature)}
        </span>
        <span className="text-ink-muted mt-0.5 flex items-center gap-1 text-[10px]">
          <Avatar person={person} size="xs" className="size-4 text-[8px]" />
          {formatTime(slot.log.recordedAt)}
        </span>
      </div>
    )
  }

  const meta = {
    overdue: { label: 'Missed', className: 'border-fail-500/40 text-fail-600 dark:text-fail-500 border-dashed' },
    due: { label: 'Due now', className: 'border-warn-500/40 text-warn-600 dark:text-warn-500 border-dashed' },
    upcoming: { label: 'Later', className: 'border-line-default text-ink-subtle border-dashed' },
    done: { label: '—', className: 'border-line-default text-ink-subtle' },
    failed: { label: '—', className: 'border-line-default text-ink-subtle' },
  }[slot.state]

  return (
    <span
      className={cn(
        'mx-auto inline-flex min-w-[88px] items-center justify-center rounded-lg border px-2 py-2.5 text-[11px] font-medium',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}
