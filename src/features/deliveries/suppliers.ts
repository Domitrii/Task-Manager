import type { Supplier } from '@/data/types'

export function normaliseSupplierName(name: string): string {
  return name.trim().toLowerCase()
}

/** The supplier with exactly this name, ignoring case, preferring an active one. */
export function matchSupplier(suppliers: Supplier[], name: string): Supplier | undefined {
  const key = normaliseSupplierName(name)
  if (!key) return undefined
  const named = suppliers.filter((supplier) => normaliseSupplierName(supplier.name) === key)
  return named.find((supplier) => supplier.active) ?? named[0]
}
