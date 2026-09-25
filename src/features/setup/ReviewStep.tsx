import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { CATEGORY_LABELS } from '@/config/navigation'
import type { PlannedChecklist, PlannedItem, SetupAnswers, SetupPlan } from '@/data/buildFromSetupPack'
import type { SetupPack } from '@/data/setupPacks'
import type { CheckPeriod, MonitoredCategory } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { cn } from '@/lib/utils'

const EQUIPMENT_GROUPS: Array<{ category: MonitoredCategory; title: string }> = [
  { category: 'fridge', title: 'Fridges' },
  { category: 'freezer', title: 'Freezers' },
  { category: 'display_fridge', title: 'Display fridges' },
  { category: 'hot_holding', title: 'Hot holding' },
]

/** Everything setup will create, with a tick box on each piece. */
export function ReviewStep({
  pack,
  answers,
  plan,
  onToggle,
}: {
  pack: SetupPack
  answers: SetupAnswers
  plan: SetupPlan
  onToggle: (key: string, include: boolean) => void
}) {
  const excluded = new Set(answers.excluded)
  const periodLabel = (period: CheckPeriod) =>
    plan.periods.find((entry) => entry.window.period === period)?.window.label ?? period
  const probes = plan.items.filter((entry) => entry.item.category === 'cooking' || entry.item.category === 'cooling')

  const itemRow = (entry: PlannedItem, detail: string) => (
    <TickRow
      key={entry.key}
      checked={!excluded.has(entry.key)}
      onChange={(include) => onToggle(entry.key, include)}
      title={entry.item.name}
      detail={detail}
    />
  )

  return (
    <div className="space-y-8">
      <div className="bg-surface border-line rounded-xl border p-4">
        <p className="text-ink text-lg leading-snug font-bold">{answers.venueName.trim()}</p>
        {answers.address.trim() ? (
          <p className="text-ink-muted mt-0.5 text-sm whitespace-pre-line">{answers.address.trim()}</p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact label="Type" value={pack.name} />
          <Fact label="Manager" value={answers.managerName.trim()} />
          <Fact label="Open" value={`${answers.openingTime}–${answers.closingTime}`} />
          <Fact label="Cooks from raw" value={answers.cooksFromRaw ? 'Yes' : 'No'} />
        </dl>
      </div>

      <ReviewSection title="Equipment" plan={plan.items.filter((entry) => !probes.includes(entry))} excluded={excluded}>
        {EQUIPMENT_GROUPS.map(({ category, title }) => {
          const entries = plan.items.filter((entry) => entry.item.category === category)
          if (entries.length === 0) return null
          return (
            <Group key={category} title={title}>
              {entries.map((entry) =>
                itemRow(
                  entry,
                  [
                    entry.item.location,
                    formatRange(entry.item),
                    entry.item.requiredChecks.length > 0
                      ? entry.item.requiredChecks.map(periodLabel).join(', ')
                      : 'Checked when needed',
                  ].join(' · '),
                ),
              )}
            </Group>
          )
        })}
      </ReviewSection>

      {probes.length > 0 ? (
        <ReviewSection
          title="Food probes"
          description="Logged batch by batch, whenever you cook or cool."
          plan={probes}
          excluded={excluded}
        >
          <Group>
            {probes.map((entry) =>
              itemRow(entry, `${CATEGORY_LABELS[entry.item.category]} · ${formatRange(entry.item)}`),
            )}
          </Group>
        </ReviewSection>
      ) : null}

      <ReviewSection title="Checklists" plan={plan.checklists} excluded={excluded}>
        <Group>
          {plan.checklists.map((entry) => (
            <ChecklistRow
              key={entry.key}
              entry={entry}
              checked={!excluded.has(entry.key)}
              onChange={(include) => onToggle(entry.key, include)}
              periodLabel={periodLabel(entry.template.period)}
            />
          ))}
        </Group>
      </ReviewSection>

      <section>
        <SectionTitle title="Check windows" description="A check counts for a window when it’s logged inside it." />
        <ul className="bg-surface border-line divide-line divide-y rounded-xl border">
          {plan.periods.map(({ window, inHours }) => (
            <li key={window.period} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
              <span className={cn('text-[15px] font-medium', inHours ? 'text-ink' : 'text-ink-subtle')}>
                {window.label}
              </span>
              <span className={cn('tabular text-sm', inHours ? 'text-ink' : 'text-ink-subtle')}>
                {inHours ? `${window.startTime}–${window.endTime}` : 'Closed then, nothing scheduled'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-muted text-xs">{label}</dt>
      <dd className="text-ink truncate text-sm font-semibold">{value}</dd>
    </div>
  )
}

function SectionTitle({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-ink text-[17px] font-bold">{title}</h2>
        {aside}
      </div>
      {description ? <p className="text-ink-muted mt-0.5 text-sm">{description}</p> : null}
    </div>
  )
}

function ReviewSection({
  title,
  description,
  plan,
  excluded,
  children,
}: {
  title: string
  description?: string
  plan: Array<{ key: string }>
  excluded: Set<string>
  children: ReactNode
}) {
  const kept = plan.filter((entry) => !excluded.has(entry.key)).length
  return (
    <section>
      <SectionTitle
        title={title}
        description={description}
        aside={
          <span className="text-ink-muted tabular shrink-0 text-sm">
            {kept === plan.length ? plan.length : `${kept} of ${plan.length}`}
          </span>
        }
      />
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div>
      {title ? (
        <h3 className="text-ink-muted mb-1.5 px-1 text-[11px] font-semibold tracking-wide uppercase">{title}</h3>
      ) : null}
      <ul className="bg-surface border-line divide-line divide-y overflow-hidden rounded-xl border">{children}</ul>
    </div>
  )
}

function TickRow({
  checked,
  onChange,
  title,
  detail,
  after,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  detail: string
  after?: ReactNode
}) {
  return (
    <li className="flex items-stretch">
      <label className="hover:bg-surface-muted/60 flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-brand-600 size-5 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[15px] font-medium', checked ? 'text-ink' : 'text-ink-subtle line-through')}>
            {title}
          </span>
          <span className={cn('block text-[13px]', checked ? 'text-ink-muted' : 'text-ink-subtle')}>{detail}</span>
        </span>
      </label>
      {after}
    </li>
  )
}

function ChecklistRow({
  entry,
  checked,
  onChange,
  periodLabel,
}: {
  entry: PlannedChecklist
  checked: boolean
  onChange: (checked: boolean) => void
  periodLabel: string
}) {
  const [open, setOpen] = useState(false)
  const critical = entry.items.filter((item) => item.critical).length
  const listId = `${entry.key}-items`

  return (
    <>
      <TickRow
        checked={checked}
        onChange={onChange}
        title={entry.template.name}
        detail={[
          periodLabel,
          `${entry.items.length} checks`,
          critical > 0 ? `${critical} critical` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        after={
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${open ? 'Hide' : 'Show'} checks in ${entry.template.name}`}
            onClick={() => setOpen((value) => !value)}
            className="text-ink-muted hover:bg-surface-muted/60 hover:text-ink flex w-14 shrink-0 items-center justify-center"
          >
            <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} />
          </button>
        }
      />
      {open ? (
        <li id={listId} className="bg-surface-muted/50 px-4 py-3">
          <ol className="space-y-2.5">
            {entry.items.map((item) => (
              <li key={item.label} className="text-sm leading-5">
                <span className="text-ink">{item.label}</span>
                {item.critical ? (
                  <span className="text-fail-600 dark:text-fail-500 ml-1.5 text-[11px] font-semibold uppercase">
                    Critical
                  </span>
                ) : null}
                {item.hint ? <span className="text-ink-muted block text-xs">{item.hint}</span> : null}
              </li>
            ))}
          </ol>
        </li>
      ) : null}
    </>
  )
}
