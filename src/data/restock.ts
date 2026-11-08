/**
 * Turning low stock into an order. A suggestion only: the manager sees it in the
 * order form, where everything can be changed before it's placed.
 */
import { selectLowStock } from './selectors'
import type { AppData, DeliveryLineCategory, StockCategory, StockItem, Supplier, SupplierOrderLine } from './types'

const CATEGORY: Record<StockCategory, DeliveryLineCategory> = {
  meat: 'chilled',
  fish: 'chilled',
  dairy: 'chilled',
  produce: 'produce',
  dry: 'ambient',
  frozen: 'frozen',
  drinks: 'ambient',
  packaging: 'non_food',
}

/** Enough to take it back to twice its low-stock level, in whole units. */
export function restockLine(item: StockItem): Omit<SupplierOrderLine, 'id'> {
  return {
    product: item.name,
    category: CATEGORY[item.category],
    quantity: Math.max(1, Math.ceil(item.parLevel * 2 - item.quantity)),
    unit: item.unit,
    unitPrice: item.costPerUnit,
  }
}

/** Where a manager orders these items: the supplier orders page, with the order started. */
export function restockLink(items: StockItem[]): string {
  return `/suppliers/orders?restock=${items.map((item) => item.id).join(',')}`
}

/** Low items by who supplies them, and the ones with no supplier to order from. */
export function lowStockBySupplier(data: AppData): { bySupplier: Array<{ supplier: Supplier; items: StockItem[] }>; unsupplied: StockItem[] } {
  const low = selectLowStock(data)
  const bySupplier = data.suppliers
    .filter((supplier) => supplier.active)
    .map((supplier) => ({ supplier, items: low.filter((item) => item.supplierId === supplier.id) }))
    .filter((group) => group.items.length > 0)
  const supplied = new Set(bySupplier.flatMap((group) => group.items.map((item) => item.id)))
  return { bySupplier, unsupplied: low.filter((item) => !supplied.has(item.id)) }
}

/** The order a `restock` link asks for: one supplier's share of the items named. */
export function restockFrom(data: AppData, ids: string[]): { supplierId: string; startWith: Array<Omit<SupplierOrderLine, 'id'>> } | null {
  const items = ids.map((id) => data.stock.find((item) => item.id === id)).filter((item): item is StockItem => Boolean(item?.supplierId))
  const supplierId = items[0]?.supplierId
  if (!supplierId) return null
  return { supplierId, startWith: items.filter((item) => item.supplierId === supplierId).map(restockLine) }
}
