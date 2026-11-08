import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { restockLink } from '@/data/restock'
import { selectLowStock, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatQuantity } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { Button, ButtonLink } from '@/components/ui/Button'
import { InfoCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PinnedAction, WITH_PINNED_ACTION } from '@/components/shared/PinnedAction'
import { useIsManager } from '@/features/temperatures/access'
import { CountModal, DeleteStockModal } from './StockModals'
import { LowStockBadge } from './StockPage'

export function StockItemPage() {
  const { id } = useParams()
  const { data } = useStore()
  const manager = useIsManager()
  const goBack = useGoBack('/stock')
  const [sheet, setSheet] = useState<'count' | 'delete' | null>(null)
  const item = data.stock.find((entry) => entry.id === id)

  if (!item) return <Navigate to="/stock" replace />

  const low = selectLowStock(data).some((entry) => entry.id === item.id)
  const supplier = data.suppliers.find((entry) => entry.id === item.supplierId)

  return (
    <div className={WITH_PINNED_ACTION}>
      <PageHeader title="Stock item" onBack={goBack} />

      <InfoCard>
        <p className="text-ink text-[15px] font-semibold">{item.name}</p>
        <p className="font-display text-ink text-[28px] leading-tight font-bold">{formatQuantity(item.quantity, item.unit)}</p>
        {low ? <LowStockBadge /> : null}
        <p className="pt-1">Low-stock level · {formatQuantity(item.parLevel, item.unit)}</p>
      </InfoCard>

      <InfoCard title="Item details">
        <p>Supplier · {supplier?.name ?? 'Not added'}</p>
        <p>Location · {item.location || 'Not added'}</p>
        {item.lastCountedAt ? (
          <p className="text-ink-subtle text-xs">
            Last updated {format(parseISO(item.lastCountedAt), 'd MMM HH:mm')}
            {item.lastCountedBy ? ` · ${staffName(data, item.lastCountedBy)}` : ''}
          </p>
        ) : null}
      </InfoCard>

      <p className="text-ink-muted text-[13px]">
        Current recorded quantity only. Stock movements and automatic consumption are not recorded here.
      </p>

      {low && supplier && manager ? (
        <ButtonLink to={restockLink([item])} variant="subtle">
          Order more from {supplier.name}
        </ButtonLink>
      ) : null}

      <Button size="sm" onClick={() => setSheet('delete')}>
        Delete {item.name}
      </Button>

      <PinnedAction>
        <Button block size="lg" variant="primary" onClick={() => setSheet('count')}>
          Count
        </Button>
      </PinnedAction>

      <CountModal item={sheet === 'count' ? item : undefined} onClose={() => setSheet(null)} />
      <DeleteStockModal item={sheet === 'delete' ? item : undefined} onClose={() => setSheet(null)} />
    </div>
  )
}
