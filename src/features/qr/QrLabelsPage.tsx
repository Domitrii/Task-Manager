import { useMemo, useState } from 'react'
import { Printer, QrCode } from 'lucide-react'
import { CATEGORY_LABELS } from '@/config/navigation'
import { useStore } from '@/data/store'
import type { ID, MonitoredCategory, MonitoredItem } from '@/data/types'
import { formatRange } from '@/lib/compliance'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { LabelGrid, PrintSheet, QrLabel } from './QrLabel'

const CATEGORY_ORDER: MonitoredCategory[] = ['fridge', 'freezer', 'display_fridge', 'hot_holding', 'cooking', 'cooling']

/** Probes are dishes rather than equipment, so they start unticked. */
const isProbe = (item: MonitoredItem) => item.category === 'cooking' || item.category === 'cooling'

export function QrLabelsPage() {
  const { data } = useStore()

  const items = useMemo(
    () =>
      data.items
        .filter((item) => item.active)
        .sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name),
        ),
    [data.items],
  )
  const [selected, setSelected] = useState<Set<ID>>(
    () => new Set(items.filter((item) => !isProbe(item)).map((item) => item.id)),
  )
  const chosen = items.filter((item) => selected.has(item.id))
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

  function toggle(id: ID, include: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (include) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="QR labels"
        description="Stick one on each unit. Staff scan it with their phone camera to log a reading without searching for the right fridge."
        actions={
          <Button
            variant="primary"
            onClick={() => window.print()}
            disabled={chosen.length === 0}
            className="gap-1.5"
          >
            <Printer className="size-4" />
            Print {chosen.length} {chosen.length === 1 ? 'label' : 'labels'}
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<QrCode className="size-5" />}
            title="Nothing to label yet"
            description="Add your fridges, freezers and hot-holding units in Settings, then come back to print their labels."
            action={<ButtonLink to="/settings">Go to Settings</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader
              title="Choose labels"
              description={`${chosen.length} of ${items.length} selected`}
              action={
                <>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(items.map((item) => item.id)))}>
                    All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    None
                  </Button>
                </>
              }
            />
            <div className="divide-line divide-y">
              {groups.map((group) => (
                <div key={group.category} role="group" aria-labelledby={`labels-${group.category}`}>
                  <h3
                    id={`labels-${group.category}`}
                    className="bg-surface-muted/70 text-ink-muted px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase sm:px-5"
                  >
                    {CATEGORY_LABELS[group.category]}
                  </h3>
                  <ul className="divide-line divide-y">
                    {group.items.map((item) => {
                      const checked = selected.has(item.id)
                      return (
                        <li key={item.id}>
                          <label className="hover:bg-surface-muted/60 flex min-h-13 cursor-pointer items-center gap-3 px-4 py-2 sm:px-5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggle(item.id, event.target.checked)}
                              className="accent-brand-600 size-5 shrink-0"
                            />
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-sm font-medium', checked ? 'text-ink' : 'text-ink-muted')}>
                                {item.name}
                              </span>
                              <span className="text-ink-muted block truncate text-xs">
                                {item.location} · {formatRange(item)}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <section aria-labelledby="labels-preview" className="min-w-0">
            <h2 id="labels-preview" className="text-ink text-[15px] font-semibold">
              Preview
            </h2>
            <p className="text-ink-muted mt-0.5 mb-3 text-[13px]">
              Each label is 60 × 66 mm, twelve to an A4 sheet. Print at 100% scale, cut along the dashed
              lines, and cover with clear tape if it goes in a fridge. Scanning works on the device that
              holds this venue’s records.
            </p>
            {chosen.length > 0 ? (
              <div className="bg-surface-muted/70 border-line overflow-x-auto rounded-xl border p-3 sm:p-4">
                <LabelGrid>
                  {chosen.map((item) => (
                    <QrLabel key={item.id} item={item} venueName={data.settings.venueName} />
                  ))}
                </LabelGrid>
              </div>
            ) : (
              <Card>
                <EmptyState title="No labels selected" description="Tick the units you want labels for." />
              </Card>
            )}
          </section>
        </div>
      )}

      {chosen.length > 0 ? (
        <PrintSheet>
          <LabelGrid>
            {chosen.map((item) => (
              <QrLabel key={item.id} item={item} venueName={data.settings.venueName} />
            ))}
          </LabelGrid>
        </PrintSheet>
      ) : null}
    </div>
  )
}
