import { SAFE_RANGES } from '../temperatureRanges'
import { CHECKS, PROBE_NOTES, windows } from './common'
import type { SetupPack } from './types'

export const cafePack: SetupPack = {
  id: 'cafe',
  name: 'Café',
  description: 'Coffee, sandwiches and cakes, with a chilled display and soup.',
  hours: { open: '08:00', close: '17:00' },
  // Cafés close before the evening, so nothing is scheduled then by default.
  periods: windows(['06:30', '08:30'], ['11:30', '14:30'], ['18:00', '20:00'], ['16:30', '18:00']),
  units: {
    fridge: { name: 'Fridge', location: 'Kitchen', ...SAFE_RANGES.fridge, requiredChecks: ['opening', 'closing'], defaultCount: 2 },
    freezer: { name: 'Freezer', location: 'Kitchen', ...SAFE_RANGES.freezer, requiredChecks: ['opening'], defaultCount: 1 },
    hot_holding: { name: 'Soup Kettle', location: 'Counter', ...SAFE_RANGES.hot_holding, requiredChecks: ['midday'], defaultCount: 1 },
  },
  extras: [
    {
      key: 'display',
      name: 'Display Fridge',
      category: 'display_fridge',
      location: 'Counter',
      ...SAFE_RANGES.display_fridge,
      requiredChecks: ['opening', 'midday', 'closing'],
      notes: 'Sandwiches, salads and cream cakes.',
    },
  ],
  cooksFromRawByDefault: false,
  probes: [
    { key: 'bacon', name: 'Bacon & Sausages', category: 'cooking', location: 'Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], notes: PROBE_NOTES.cook },
    { key: 'chicken', name: 'Chicken for Sandwiches', category: 'cooking', location: 'Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], notes: PROBE_NOTES.cook },
    { key: 'soup', name: 'Reheated Soup', category: 'cooking', location: 'Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], notes: PROBE_NOTES.reheat },
    { key: 'soup-cooling', name: 'Soup Batch (cooling)', category: 'cooling', location: 'Kitchen', ...SAFE_RANGES.cooling, requiredChecks: [], notes: PROBE_NOTES.cool },
    { key: 'chicken-cooling', name: 'Cooked Chicken (cooling)', category: 'cooling', location: 'Kitchen', ...SAFE_RANGES.cooling, requiredChecks: [], notes: PROBE_NOTES.cool },
  ],
  checklists: [
    {
      key: 'opening',
      name: 'Café Opening Checks',
      type: 'opening',
      period: 'opening',
      area: 'Café',
      items: [
        CHECKS.temperaturesRecorded,
        CHECKS.handWash,
        CHECKS.noPests,
        CHECKS.probe,
        CHECKS.staffFit,
        { label: 'Coffee machine steam wand purged and wiped', critical: false },
        { label: 'Milk in date and in the fridge, jugs clean', critical: false },
        CHECKS.surfacesClean,
      ],
    },
    {
      key: 'closing',
      name: 'Café Closing Checks',
      type: 'closing',
      period: 'closing',
      area: 'Café',
      items: [
        { label: 'Sandwiches, salads and cakes past their date taken off display', critical: true },
        { label: 'Opened milk and dairy dated, or thrown away', hint: 'Follow the “once opened” time on the label', critical: false },
        CHECKS.hotHoldingEmptied,
        CHECKS.coveredLabelled,
        CHECKS.closingTemperatures,
        { label: 'Coffee machine back-flushed, group heads and drip tray cleaned', critical: false },
        CHECKS.bins,
      ],
    },
    {
      key: 'food-safety',
      name: 'Allergens & Food Safety',
      type: 'food_safety',
      period: 'midday',
      area: 'Counter',
      items: [
        CHECKS.ppdsLabels,
        CHECKS.allergenMatrix,
        { label: 'Separate tongs for each item on the counter', critical: false },
        {
          label: 'Cream, custard and fresh-fruit cakes kept in the display fridge',
          hint: 'Chilled display at 8°C or below',
          critical: false,
        },
        CHECKS.hotHeldAbove63,
        CHECKS.rawSeparate,
        CHECKS.cookedThrough,
        CHECKS.cooledInTime,
      ],
    },
    {
      key: 'clean',
      name: 'Café Clean',
      type: 'cleaning',
      period: 'closing',
      area: 'Café',
      items: [
        CHECKS.sanitiser,
        { label: 'Tables, chairs and high chairs sanitised', critical: false },
        CHECKS.toilets,
        { label: 'Grinder hopper and doser brushed out', critical: false },
        { label: 'Display fridge glass, shelves and seals cleaned', critical: false },
        CHECKS.floors,
      ],
    },
  ],
}
