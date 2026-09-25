/**
 * Wording shared by several packs, so the same check reads the same way
 * whichever pack a venue starts from. Packs pick from these and add their own.
 */
import type { CheckPeriodWindow } from '../types'
import type { PackChecklistItem } from './types'

export const CHECKS = {
  // Opening
  temperaturesRecorded: { label: 'Fridge and freezer temperatures recorded', critical: true },
  handWash: { label: 'Hand-wash basins stocked with hot water, soap and paper towels', critical: true },
  probe: {
    label: 'Probe thermometer checked and sanitised',
    hint: 'Iced water should read −1°C to 1°C, boiling water 99°C to 101°C',
    critical: true,
  },
  noPests: { label: 'No signs of pests: droppings, gnaw marks or insects', critical: true },
  staffFit: {
    label: 'Everyone on shift is fit for work',
    hint: 'Nobody handles food within 48 hours of sickness or diarrhoea',
    critical: true,
  },
  uniform: { label: 'Clean uniforms on, hair tied back or covered, no jewellery', critical: false },
  surfacesClean: { label: 'Prep surfaces and equipment clean and sanitised before use', critical: false },
  chemicals: { label: 'Cleaning chemicals stored away from food and labelled', critical: false },

  // Closing
  useBy: { label: 'Food past its use-by date thrown away', critical: true },
  coveredLabelled: { label: 'Food in fridges covered, labelled and dated', critical: true },
  rawBelow: { label: 'Raw meat and fish stored below ready-to-eat food', critical: true, when: 'cooksFromRaw' },
  hotHoldingEmptied: {
    label: 'Hot holding emptied and leftover hot food thrown away',
    hint: 'Hot-held food is never cooled and served again the next day',
    critical: false,
    when: 'hotHolding',
  },
  closingTemperatures: { label: 'Closing fridge and freezer temperatures recorded', critical: true },
  cloths: { label: 'Dirty cloths sent for washing, clean ones out for tomorrow', critical: false },
  bins: { label: 'Bins emptied, bin area clean and lids closed', critical: false },
  isolated: { label: 'Gas and electrical equipment switched off', critical: false },

  // Food safety
  rawSeparate: {
    label: 'Raw and ready-to-eat food kept apart at every stage',
    hint: 'Separate boards, utensils and storage',
    critical: true,
    when: 'cooksFromRaw',
  },
  allergenMatrix: {
    label: 'Allergen information matches today’s menu and specials',
    hint: 'Covers all 14 allergens, and every member of staff knows where it is',
    critical: true,
  },
  allergyOrders: { label: 'Allergy orders flagged on the ticket and checked at the pass', critical: true },
  ppdsLabels: {
    label: 'Food packed here before ordering is labelled with full ingredients',
    hint: 'Natasha’s Law: name, ingredients, and allergens in bold on every prepacked-for-direct-sale item',
    critical: true,
  },
  cookedThrough: {
    label: 'Every batch of high-risk food probed to 75°C and recorded',
    critical: true,
    when: 'cooksFromRaw',
  },
  cooledInTime: {
    label: 'Batch-cooked food cooled to 8°C within 90 minutes',
    hint: 'Shallow trays or a blast chiller, then straight into the fridge',
    critical: false,
    when: 'cooksFromRaw',
  },
  hotHeldAbove63: {
    label: 'Hot-held food kept at 63°C or above',
    hint: 'Food below 63°C for more than 2 hours must be thrown away',
    critical: false,
    when: 'hotHolding',
  },
  colourCoding: {
    label: 'Colour-coded boards and knives used correctly',
    hint: 'Red raw meat, blue raw fish, yellow cooked meat, green salad and fruit, brown veg, white bakery and dairy',
    critical: false,
    when: 'cooksFromRaw',
  },
  defrosting: { label: 'Frozen food defrosted in the fridge, not at room temperature', critical: false },

  // Cleaning
  sanitiser: {
    label: 'Sanitiser made up at the right dilution',
    hint: 'Check the contact time on the label. It should meet BS EN 1276 or BS EN 13697',
    critical: false,
  },
  extraction: { label: 'Extraction canopy filters degreased', critical: false },
  fryers: { label: 'Fryers filtered, oil changed if dark, foaming or smoking', critical: false },
  barTop: { label: 'Bar top, taps and drip trays cleaned', critical: false },
  iceScoop: { label: 'Ice machine wiped, scoop stored outside the ice', critical: true },
  fridgeSeals: { label: 'Fridge seals, handles and shelves sanitised', critical: false },
  floors: { label: 'Floors swept and mopped, including under counters', critical: false },
  toilets: { label: 'Customer toilets cleaned and restocked with soap and paper', critical: false },
} satisfies Record<string, PackChecklistItem>

export const PROBE_NOTES = {
  cook: 'Core temperature, probed at the thickest part.',
  reheat: 'Reheat until piping hot all the way through: 75°C or above (82°C in Scotland). Reheat once only.',
  cool: 'Must reach 8°C or below within 90 minutes.',
}

/** Labels are kept the same in every pack; only the times differ. */
export function windows(
  opening: [string, string],
  midday: [string, string],
  evening: [string, string],
  closing: [string, string],
): CheckPeriodWindow[] {
  return [
    { period: 'opening', label: 'Opening', startTime: opening[0], endTime: opening[1] },
    { period: 'midday', label: 'Midday', startTime: midday[0], endTime: midday[1] },
    { period: 'evening', label: 'Evening', startTime: evening[0], endTime: evening[1] },
    { period: 'closing', label: 'Closing', startTime: closing[0], endTime: closing[1] },
  ]
}
