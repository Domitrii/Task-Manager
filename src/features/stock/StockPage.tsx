import { useMemo, useState } from 'react'
import { Boxes, ClipboardList, SearchX, TriangleAlert } from 'lucide-react'
import { lowStockBySupplier, restockLink } from '@/data/restock'
import { selectLowStock } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatQuantity } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { SearchField } from '@/components/shared/SearchField'
import { useIsManager } from '@/features/temperatures/access'
import { AddStockItemModal } from './AddStockItemModal'

export function LowStockBadge() {
  return (
    <Badge tone="warn" icon={<TriangleAlert className="size-3.5" />}>
      Low stock
    </Badge>
  )
}

export function StockPage() {
  const { data } = useStore()
  const goBack = useGoBack('/more')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const manager = useIsManager()
  const restock = useMemo(() => lowStockBySupplier(data), [data])

  const low = useMemo(() => new Set(selectLowStock(data).map((item) => item.id)), [data])
  const needle = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      data.stock
        .filter((item) => item.name.toLowerCase().includes(needle))
        .sort((a, b) => Number(low.has(b.id)) - Number(low.has(a.id)) || a.name.localeCompare(b.name)),
    [data.stock, needle, low],
  )

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Stock" onBack={goBack} />

      {data.stock.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No stock items yet"
          description="Add an item and its quantity to start your kitchen inventory."
        />
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} placeholder="Search inventory" />
          {shown.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No matching items"
              description={`No results for “${query.trim()}”. Your inventory is still here; try another item name.`}
              action={<Button onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : (
            <>
              <p className="text-ink-muted text-[13px]">
                {data.stock.length} {data.stock.length === 1 ? 'item' : 'items'} · {low.size} low-stock{' '}
                {low.size === 1 ? 'item' : 'items'}
              </p>
              {manager && restock.bySupplier.length > 0 && !needle ? (
                <section aria-labelledby="order-low" className="bg-surface shadow-card rounded-card space-y-2.5 p-3.5">
                  <h2 id="order-low" className="text-ink text-[15px] font-semibold">
                    Order what’s low
                  </h2>
                  <ul className="space-y-2">
                    {restock.bySupplier.map(({ supplier, items }) => (
                      <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="text-ink block text-sm font-medium">{supplier.name}</span>
                          <span className="text-ink-muted block text-xs">
                            {items.map((item) => item.name).join(', ')}
                          </span>
                        </span>
                        <ButtonLink to={restockLink(items)} size="sm" variant="subtle">
                          Start order
                        </ButtonLink>
                      </li>
                    ))}
                  </ul>
                  {restock.unsupplied.length > 0 ? (
                    <p className="text-ink-muted text-xs">
                      {restock.unsupplied.length} low {restock.unsupplied.length === 1 ? 'item has' : 'items have'} no
                      supplier set, so {restock.unsupplied.length === 1 ? 'it isn’t' : 'they aren’t'} listed.
                    </p>
                  ) : null}
                </section>
              ) : null}
              <ul className="space-y-2.5">
                {shown.map((item) => (
                  <li key={item.id}>
                    <ListCard
                      to={`/stock/${item.id}`}
                      icon={Boxes}
                      title={item.name}
                      subtitle={`${formatQuantity(item.quantity, item.unit)} · Minimum ${formatQuantity(item.parLevel, item.unit)}`}
                    >
                      {low.has(item.id) ? <LowStockBadge /> : null}
                    </ListCard>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setAdding(true)}>
          Add item
        </Button>
      </PinnedAction>
      {adding ? <AddStockItemModal onClose={() => setAdding(false)} /> : null}
    </div>
  )
}
