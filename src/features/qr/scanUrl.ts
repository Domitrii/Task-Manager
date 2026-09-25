import type { ID } from '@/data/types'

/**
 * What every label encodes. Built from the current origin, so the same code
 * works on localhost and on the deployed site.
 */
export function scanUrl(itemId: ID): string {
  return `${window.location.origin}/scan/${encodeURIComponent(itemId)}`
}
