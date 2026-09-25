import { SAFE_RANGES } from '../temperatureRanges'
import { CHECKS, PROBE_NOTES, windows } from './common'
import type { SetupPack } from './types'

export const bakeryPack: SetupPack = {
  id: 'bakery',
  name: 'Bakery',
  description: 'Early bake, shop counter, cream cakes and hot savouries.',
  hours: { open: '07:00', close: '17:00' },
  // Bakers start well before the shop opens. Nothing is scheduled in the evening.
  periods: windows(['05:00', '07:30'], ['11:00', '14:00'], ['18:00', '20:00'], ['16:00', '18:00']),
  units: {
    fridge: { name: 'Fridge', location: 'Bakehouse', ...SAFE_RANGES.fridge, requiredChecks: ['opening', 'closing'], defaultCount: 2 },
    freezer: { name: 'Freezer', location: 'Bakehouse', ...SAFE_RANGES.freezer, requiredChecks: ['opening'], defaultCount: 2 },
    hot_holding: { name: 'Hot Counter', location: 'Shop', ...SAFE_RANGES.hot_holding, requiredChecks: ['midday'], defaultCount: 1 },
  },
  extras: [
    {
      key: 'cake-display',
      name: 'Cake Display Fridge',
      category: 'display_fridge',
      location: 'Shop',
      ...SAFE_RANGES.display_fridge,
      requiredChecks: ['opening', 'midday', 'closing'],
      notes: 'Cream, custard and fresh-fruit products.',
    },
  ],
  cooksFromRawByDefault: true,
  probes: [
    { key: 'sausage-rolls', name: 'Sausage Rolls', category: 'cooking', location: 'Bakehouse', ...SAFE_RANGES.cooking, requiredChecks: [], notes: 'Probe the centre of the thickest roll on each tray.' },
    { key: 'pasties', name: 'Pasties & Pies', category: 'cooking', location: 'Bakehouse', ...SAFE_RANGES.cooking, requiredChecks: [], notes: PROBE_NOTES.cook },
    { key: 'quiche', name: 'Quiche', category: 'cooking', location: 'Bakehouse', ...SAFE_RANGES.cooking, requiredChecks: [], notes: PROBE_NOTES.cook },
    { key: 'custard-cooling', name: 'Custard & Crème Pâtissière (cooling)', category: 'cooling', location: 'Bakehouse', ...SAFE_RANGES.cooling, requiredChecks: [], notes: PROBE_NOTES.cool },
    { key: 'pies-cooling', name: 'Pies for Cold Sale (cooling)', category: 'cooling', location: 'Bakehouse', ...SAFE_RANGES.cooling, requiredChecks: [], notes: PROBE_NOTES.cool },
  ],
  checklists: [
    {
      key: 'bakehouse-opening',
      name: 'Bakehouse Opening Checks',
      type: 'opening',
      period: 'opening',
      area: 'Bakehouse',
      items: [
        CHECKS.temperaturesRecorded,
        CHECKS.handWash,
        {
          label: 'No signs of pests in the flour store or sack stacks',
          hint: 'Look for weevils, droppings and gnawed sacks',
          critical: true,
        },
        CHECKS.probe,
        CHECKS.staffFit,
        CHECKS.uniform,
        { label: 'Ovens and provers up to temperature', critical: false },
      ],
    },
    {
      key: 'shop-opening',
      name: 'Shop Opening Checks',
      type: 'opening',
      period: 'opening',
      area: 'Shop',
      items: [
        { label: 'Every product on display has a price and allergen label', critical: true },
        { label: 'Separate tongs and bags for each product', critical: false },
        { label: 'Cream and custard products in the chilled display', hint: 'Chilled display at 8°C or below', critical: false },
        { label: 'Display glass, counter and card machine wiped', critical: false },
      ],
    },
    {
      key: 'allergens',
      name: 'Allergens & Labelling',
      type: 'food_safety',
      period: 'midday',
      area: 'Shop',
      items: [
        CHECKS.ppdsLabels,
        { label: 'Nut and sesame products kept apart, with their own tongs and trays', critical: true },
        {
          label: 'Allergen folder matches today’s range, including specials',
          hint: 'Recheck whenever a recipe or an ingredient supplier changes',
          critical: true,
        },
        {
          label: 'Chilled products out of the fridge for no more than 4 hours',
          hint: 'After 4 hours above 8°C they must be thrown away',
          critical: false,
        },
        CHECKS.hotHeldAbove63,
        CHECKS.cookedThrough,
        CHECKS.cooledInTime,
      ],
    },
    {
      key: 'closing',
      name: 'Bakery Closing Checks',
      type: 'closing',
      period: 'closing',
      area: 'Bakehouse & Shop',
      items: [
        { label: 'Unsold cream and custard products thrown away or back in the fridge', hint: 'Only if they have been out for less than 4 hours', critical: true },
        CHECKS.hotHoldingEmptied,
        { label: 'Doughs and fillings covered, labelled and dated in the fridge', critical: true },
        CHECKS.closingTemperatures,
        { label: 'Flour and dry ingredients in lidded, labelled bins', critical: false },
        { label: 'Ovens off, mixers and slicers isolated', critical: false },
        CHECKS.bins,
      ],
    },
    {
      key: 'clean',
      name: 'Bakehouse Clean',
      type: 'cleaning',
      period: 'closing',
      area: 'Bakehouse',
      items: [
        CHECKS.sanitiser,
        { label: 'Mixers, bowls and dough hooks washed and dried', critical: false },
        { label: 'Benches scraped down and sanitised', critical: false },
        { label: 'Bread slicer cleaned and guard refitted', hint: 'Switch off at the wall first', critical: false },
        { label: 'Oven racks and baking trays cleaned', critical: false },
        { label: 'Floors swept of flour, then mopped', critical: false },
      ],
    },
  ],
}
