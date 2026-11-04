import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, SearchX, Truck } from 'lucide-react'
import { useStore } from '@/data/store'
import type { Supplier } from '@/data/types'
import { useGoBack } from '@/lib/useGoBack'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { SearchField } from '@/components/shared/SearchField'
import { AddSupplierModal, WEEKDAYS } from './AddSupplierModal'

/** "Tue / Thu / Sat", or null if none are set. */
export function deliveryDaysText(supplier: Supplier): string | null {
  const days = WEEKDAYS.filter((day) => supplier.deliveryDays?.includes(day.value)).map((day) => day.label)
  return days.length > 0 ? days.join(' / ') : null
}

function summary(supplier: Supplier): string {
  const contact = supplier.email ? 'Email available' : supplier.phone ? 'Phone available' : 'Contact not added'
  return `${deliveryDaysText(supplier) ?? 'Delivery days not added'} · ${contact}`
}

export function SuppliersListPage() {
  const { data } = useStore()
  const goBack = useGoBack('/more')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const active = useMemo(() => data.suppliers.filter((entry) => entry.active), [data.suppliers])
  const needle = query.trim().toLowerCase()
  const shown = active.filter((entry) => entry.name.toLowerCase().includes(needle))

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Suppliers" onBack={goBack} />

      {active.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="No suppliers yet"
          description="Add your suppliers to keep contact details and delivery days in one place."
        />
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} placeholder="Search suppliers" />
          {shown.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No matching suppliers"
              description={`No results for “${query.trim()}”. Try another supplier name.`}
              action={<Button onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : (
            <>
              <p className="text-ink-muted text-[13px]">
                {active.length} {active.length === 1 ? 'supplier' : 'suppliers'} · {data.settings.venueName}
              </p>
              <ul className="space-y-2.5">
                {shown.map((supplier) => (
                  <li key={supplier.id}>
                    <ListCard to={`/suppliers/${supplier.id}`} icon={Truck} title={supplier.name} subtitle={summary(supplier)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Link
        to="/suppliers/orders"
        className="text-brand-700 dark:text-brand-300 flex items-center gap-1 py-1 text-sm font-semibold"
      >
        Orders and upcoming deliveries
        <ChevronRight className="size-4" />
      </Link>

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setAdding(true)}>
          Add supplier
        </Button>
      </PinnedAction>
      {adding ? <AddSupplierModal onClose={() => setAdding(false)} /> : null}
    </div>
  )
}
