import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays } from 'date-fns'
import { AlertTriangle, CalendarClock, ChevronRight, ClipboardList, Lock, Plus, Settings2, Truck } from 'lucide-react'
import {
  selectOrdersToCheckIn,
  selectSupplierOrders,
  selectUpcomingOrders,
  type SupplierOrderBook,
} from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ID, Supplier, SupplierOrder } from '@/data/types'
import { orderState, toISODate } from '@/lib/compliance'
import { formatWeekdayDate } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { useSync } from '@/features/account/sync'
import { LINE_CATEGORIES } from '@/features/deliveries/lines'
import { useIsManager } from '@/features/temperatures/access'
import { CancelOrderModal } from './OrderActions'
import { OrderBlock } from './OrderBlock'
import { OrderDetailModal } from './OrderDetailModal'
import { OrderFormModal } from './OrderFormModal'
import { OrderHistoryList, OrderHistoryModal } from './OrderHistory'

/** How many past orders a supplier's card shows before "All past orders". */
const HISTORY_ON_CARD = 3

type Sheet =
  | { type: 'form'; supplierId?: ID; existing?: SupplierOrder; repeatOf?: SupplierOrder }
  | { type: 'history'; supplierId: ID }
  | { type: 'cancel'; order: SupplierOrder }

/**
 * Where deliveries are planned. Every upcoming order is laid out in full at
 * the top, as the manager left it; on its delivery day it moves to the
 * Deliveries page to be checked in. Below, each supplier with what came before.
 */
export function SuppliersPage() {
  const now = useNow()
  const { data } = useStore()
  const manager = useIsManager()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = useCallback(() => setSheet(null), [])

  // In the address, so a delivery can link to the order it came from.
  const selectedId = searchParams.get('order') ?? undefined
  const setSelectedId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (id) next.set('order', id)
          else next.delete('order')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const selected = data.supplierOrders.find((order) => order.id === selectedId)

  const suppliers = useMemo(() => data.suppliers.filter((supplier) => supplier.active), [data.suppliers])
  const books = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, selectSupplierOrders(data, supplier.id, now)])),
    [data, suppliers, now],
  )
  const upcoming = useMemo(() => selectUpcomingOrders(data, now), [data, now])

  const stats = useMemo(() => {
    const weekEnd = toISODate(addDays(now, 7))
    const drafts = upcoming.filter((order) => !order.deliveryDate).length
    const thisWeek = upcoming.filter((order) => order.deliveryDate && order.deliveryDate <= weekEnd)
    return { drafts, thisWeek, ...selectOrdersToCheckIn(data, now) }
  }, [data, upcoming, now])
  const next = stats.thisWeek[0]

  const newOrder = () => setSheet({ type: 'form' })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppliers & orders"
        description={
          manager
            ? 'Plan each delivery here: who it’s from, when it’s coming and what’s on it. On its delivery day it moves to Deliveries to be checked in.'
            : 'What’s been ordered and when it’s coming. Managers place and change orders; anyone can check one in on the Deliveries page when it arrives.'
        }
        actions={
          <>
            <ButtonLink to="/settings?tab=suppliers">
              <Settings2 className="size-4" />
              Edit suppliers
            </ButtonLink>
            {manager && suppliers.length > 0 ? (
              <Button variant="primary" onClick={newOrder}>
                <Plus className="size-4" />
                New order
              </Button>
            ) : null}
          </>
        }
      />

      {manager ? null : <WhoCanOrder />}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Upcoming orders"
          value={upcoming.length}
          sublabel={stats.drafts > 0 ? `${stats.drafts} draft${stats.drafts === 1 ? '' : 's'} without dates` : 'All have dates'}
          icon={<ClipboardList className="size-4" />}
        />
        <StatCard
          label="Arriving in 7 days"
          value={stats.thisWeek.length}
          sublabel={
            next?.deliveryDate
              ? `Next ${formatWeekdayDate(next.deliveryDate)}, ${data.suppliers.find((supplier) => supplier.id === next.supplierId)?.name ?? ''}`
              : 'Nothing booked'
          }
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Due today"
          value={stats.due.length}
          sublabel="Checked in on Deliveries"
          icon={<Truck className="size-4" />}
          tone={stats.due.length > 0 ? 'brand' : 'neutral'}
          to="/deliveries"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue.length}
          sublabel="Didn’t arrive on the day"
          icon={<AlertTriangle className="size-4" />}
          tone={stats.overdue.length > 0 ? 'fail' : 'neutral'}
          to="/deliveries"
        />
      </div>

      <section aria-labelledby="upcoming" className="space-y-3">
        <div>
          <h2 id="upcoming" className="text-ink text-[17px] font-bold">
            Upcoming deliveries <span className="text-ink-muted font-normal">({upcoming.length})</span>
          </h2>
          <p className="text-ink-muted text-[13px]">
            Soonest first, then drafts still waiting for dates from the supplier.
          </p>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title="No deliveries planned"
              description={
                suppliers.length === 0
                  ? 'Add the suppliers you order from in Settings, then plan deliveries with them here.'
                  : manager
                    ? 'Place an order with a supplier and it shows here until its delivery day.'
                    : 'Orders a manager places show here until their delivery day.'
              }
              action={
                suppliers.length === 0 ? (
                  <ButtonLink variant="primary" size="sm" to="/settings?tab=suppliers">
                    Add suppliers
                  </ButtonLink>
                ) : manager ? (
                  <Button variant="primary" size="sm" onClick={newOrder}>
                    <Plus className="size-4" />
                    New order
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {upcoming.map((order) => (
              <OrderBlock
                key={order.id}
                order={order}
                now={now}
                onEdit={
                  manager ? () => setSheet({ type: 'form', supplierId: order.supplierId, existing: order }) : undefined
                }
                onCancel={manager ? () => setSheet({ type: 'cancel', order }) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {suppliers.length > 0 ? (
        <section aria-labelledby="supplier-list" className="space-y-3 pt-2">
          <div>
            <h2 id="supplier-list" className="text-ink text-[17px] font-bold">
              Suppliers and past orders
            </h2>
            <p className="text-ink-muted text-[13px]">
              What came before, with anything that was short or missing.
              {manager ? ' Repeat a past order to plan the next one.' : ''}
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {suppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                book={books.get(supplier.id) ?? { open: [], arriving: [], history: [] }}
                now={now}
                manager={manager}
                onNew={() => setSheet({ type: 'form', supplierId: supplier.id })}
                onRepeat={(order) => setSheet({ type: 'form', supplierId: order.supplierId, repeatOf: order })}
                onOpen={(order) => setSelectedId(order.id)}
                onHistory={() => setSheet({ type: 'history', supplierId: supplier.id })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <OrderDetailModal
        order={selected}
        onClose={() => setSelectedId(undefined)}
        onEdit={
          manager
            ? (order) => {
                setSelectedId(undefined)
                setSheet({ type: 'form', supplierId: order.supplierId, existing: order })
              }
            : undefined
        }
        onRepeat={
          manager
            ? (order) => {
                setSelectedId(undefined)
                setSheet({ type: 'form', supplierId: order.supplierId, repeatOf: order })
              }
            : undefined
        }
        onCancel={
          manager
            ? (order) => {
                setSelectedId(undefined)
                setSheet({ type: 'cancel', order })
              }
            : undefined
        }
      />

      {/* Mounted only while open, so each form seeds fresh from what it was opened with. */}
      {sheet?.type === 'form' ? (
        <OrderFormModal
          supplierId={sheet.supplierId}
          existing={sheet.existing}
          repeatOf={sheet.repeatOf}
          onClose={close}
        />
      ) : null}
      {sheet?.type === 'cancel' ? <CancelOrderModal order={sheet.order} onClose={close} /> : null}
      {sheet?.type === 'history' ? (
        <HistorySheet
          supplierId={sheet.supplierId}
          book={books.get(sheet.supplierId)}
          manager={manager}
          onClose={close}
          onOpen={(order) => {
            close()
            setSelectedId(order.id)
          }}
          onRepeat={(order) => setSheet({ type: 'form', supplierId: order.supplierId, repeatOf: order })}
        />
      ) : null}
    </div>
  )
}

/** Why there's no New order button, and how to get one. */
function WhoCanOrder() {
  const synced = useSync() !== null
  return (
    <div className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5">
      <Lock className="text-ink-subtle size-4 shrink-0" />
      <p className="text-ink-muted min-w-0 flex-1 text-[13px]">
        {synced ? (
          <>
            <span className="text-ink font-medium">Only managers can place orders.</span> The team owner can make you
            one in Settings → Team, under <span className="text-ink">What people can do</span>. Your job title on the
            team list doesn’t change it.
          </>
        ) : (
          <>
            <span className="text-ink font-medium">Only someone down as a Manager can place orders.</span> Switch person
            from the top bar, or change roles in Settings → Team.
          </>
        )}
      </p>
      <ButtonLink size="sm" variant="ghost" to="/settings?tab=staff">
        Team settings
      </ButtonLink>
    </div>
  )
}

function HistorySheet({
  supplierId,
  book,
  manager,
  onClose,
  onOpen,
  onRepeat,
}: {
  supplierId: ID
  book: SupplierOrderBook | undefined
  manager: boolean
  onClose: () => void
  onOpen: (order: SupplierOrder) => void
  onRepeat: (order: SupplierOrder) => void
}) {
  const { data } = useStore()
  const supplier = data.suppliers.find((entry) => entry.id === supplierId)
  if (!supplier || !book) return null
  return (
    <OrderHistoryModal
      supplier={supplier}
      orders={book.history}
      onClose={onClose}
      onOpen={onOpen}
      onRepeat={manager ? onRepeat : undefined}
    />
  )
}

function SupplierCard({
  supplier,
  book,
  now,
  manager,
  onNew,
  onRepeat,
  onOpen,
  onHistory,
}: {
  supplier: Supplier
  book: SupplierOrderBook
  now: Date
  manager: boolean
  onNew: () => void
  onRepeat: (order: SupplierOrder) => void
  onOpen: (order: SupplierOrder) => void
  onHistory: () => void
}) {
  const categories = supplier.categories
    .map((category) => LINE_CATEGORIES.find((entry) => entry.value === category)?.label ?? category)
    .join(', ')
  const overdue = book.arriving.filter((order) => orderState(order, now) === 'overdue').length
  const dueToday = book.arriving.length - overdue
  const upcoming = book.open.length

  return (
    <Card as="article" className="min-w-0">
      <CardHeader
        title={supplier.name}
        description={[
          categories,
          supplier.contactName,
          supplier.phone,
          upcoming > 0 ? `${upcoming} upcoming` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          manager ? (
            <Button size="sm" onClick={onNew}>
              <Plus className="size-4" />
              New order
            </Button>
          ) : null
        }
      />

      {book.arriving.length > 0 ? (
        <Link
          to="/deliveries"
          className={cn(
            'mx-4 mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors sm:mx-5',
            overdue > 0
              ? 'border-fail-500/35 bg-fail-50 text-fail-700 hover:bg-fail-50/70 dark:bg-fail-500/10 dark:text-fail-500'
              : 'border-brand-500/35 bg-brand-50 text-brand-800 hover:bg-brand-50/70 dark:bg-brand-500/12 dark:text-brand-200',
          )}
        >
          {overdue > 0 ? <AlertTriangle className="size-4 shrink-0" /> : <Truck className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1">
            {[dueToday > 0 ? `${dueToday} due today` : null, overdue > 0 ? `${overdue} overdue` : null]
              .filter(Boolean)
              .join(', ')}
            <span className="font-normal"> · check in on Deliveries</span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      ) : null}

      <section className="px-4 pt-3 pb-2 sm:px-5" aria-label={`Past orders with ${supplier.name}`}>
        <h3 className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
          History <span className="font-normal">({book.history.length})</span>
        </h3>
        {book.history.length === 0 ? (
          <p className="text-ink-subtle py-2.5 text-[13px]">No past orders yet.</p>
        ) : (
          <div className="-mx-2 mt-1">
            <OrderHistoryList
              orders={book.history.slice(0, HISTORY_ON_CARD)}
              onOpen={onOpen}
              onRepeat={manager ? onRepeat : undefined}
            />
          </div>
        )}
        {book.history.length > HISTORY_ON_CARD ? (
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={onHistory}>
            All {book.history.length} past orders
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </section>
    </Card>
  )
}
