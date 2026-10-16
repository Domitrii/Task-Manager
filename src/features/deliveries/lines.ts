/** Delivery line options and rules shared by the delivery form, the order form and check-in. */
import type { DeliveryLine, DeliveryLineCategory, VenueSettings } from '@/data/types'
import { deliveryLineConcern, deliveryTempLimit } from '@/lib/compliance'

export const LINE_CATEGORIES: Array<{ value: DeliveryLineCategory; label: string }> = [
  { value: 'chilled', label: 'Chilled' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'produce', label: 'Produce' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'non_food', label: 'Non-food' },
]

export const UNITS = ['kg', 'g', 'litres', 'units', 'cases', 'trays', 'drums', 'rolls']

export const REJECTION_REASONS = [
  'Temperature above the accepted limit on arrival',
  'Signs of thawing or refreezing',
  'Outer packaging damaged in transit',
  'Packaging contaminated or leaking',
  'Use-by date too short on arrival',
  'Incorrect product or quantity supplied',
  'Poor visual quality or odour',
]

/** Goods that are probed on arrival: chilled, frozen, produce and bakery. */
export function isProbed(category: DeliveryLineCategory, settings: VenueSettings): boolean {
  return deliveryTempLimit({ category }, settings) !== null
}

/**
 * `line` with `changes` applied, keeping to the delivery rules: switching
 * category decides whether a temperature applies, and anything the rules flag
 * defaults to rejected (staff can still override, with a reason).
 * `emptyTemperature` is what a newly probed line starts at.
 */
export function changeLine(
  line: DeliveryLine,
  changes: Partial<DeliveryLine>,
  settings: VenueSettings,
  emptyTemperature: number | null = 0,
): DeliveryLine {
  const next = { ...line, ...changes }
  const flagged = deliveryLineConcern(line, settings)

  if (changes.category) {
    next.temperature = isProbed(changes.category, settings) ? (line.temperature ?? emptyTemperature) : null
  }

  const concern = deliveryLineConcern(next, settings)
  if (concern && line.accepted && (changes.temperature !== undefined || changes.packaging !== undefined)) {
    next.accepted = false
    next.rejectionReason = next.rejectionReason ?? concern
  }
  // Rejected only because the rules flagged it, and now they don't: typing "-18" passes through "-1".
  // A reason someone chose themselves stays.
  if (!concern && flagged && !next.accepted && next.rejectionReason === flagged && changes.accepted === undefined) {
    next.accepted = true
    next.rejectionReason = undefined
  }
  if (changes.accepted === true) next.rejectionReason = undefined
  return next
}
