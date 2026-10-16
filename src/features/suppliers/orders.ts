import type { SupplierOrder } from '@/data/types'
import { orderTotal } from '@/lib/compliance'
import { formatMoney } from '@/lib/format'

/** "4 items · £123.40", noting any items still without a price. */
export function orderSummary(lines: SupplierOrder['lines']): string {
  const { total, unpriced } = orderTotal(lines)
  const items = `${lines.length} item${lines.length === 1 ? '' : 's'}`
  if (unpriced === lines.length) return `${items} · no prices yet`
  return `${items} · ${formatMoney(total)}${unpriced > 0 ? ` + ${unpriced} unpriced` : ''}`
}

export function productList(lines: Array<{ product: string }>): string {
  return lines.map((line) => line.product).join(', ')
}
