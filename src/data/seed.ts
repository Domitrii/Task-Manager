/**
 * Demo data.
 *
 * Generates ~2 weeks of plausible venue history so every screen has something
 * real to render. Today is deliberately left partially complete: periods whose
 * window has already opened are mostly logged, with a few gaps so the dashboard
 * shows genuine "due" and "overdue" states rather than a perfect green board.
 */
import { addDays, addMinutes, subDays, subHours } from 'date-fns'
import { periodInterval, deriveDeliveryStatus, evaluateTemperature, toISODate } from '@/lib/compliance'
import { createId } from '@/lib/utils'
import { DELIVERY_LIMITS, SAFE_RANGES } from './temperatureRanges'
import type {
  AppData,
  ChecklistRun,
  ChecklistTemplate,
  Delivery,
  DeliveryLine,
  FoodSafetyIssue,
  MonitoredItem,
  StaffMember,
  StockItem,
  Supplier,
  Task,
  TemperatureLog,
  VenueSettings,
} from './types'

/** Deterministic PRNG so a regenerated demo set stays comparable run to run. */
function mulberry32(seed: number) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260917)

const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)]
const chance = (probability: number) => rand() < probability
const between = (min: number, max: number) => min + rand() * (max - min)
const roundTo = (value: number, decimals = 1) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/* -------------------------------------------------------------------------- */
/* Static records                                                              */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SETTINGS: VenueSettings = {
  venueName: 'The Copper Larder',
  siteReference: 'CL-001',
  address: '42 Wharf Street, Manchester M1 5EJ',
  temperatureUnit: 'C',
  periods: [
    { period: 'opening', label: 'Opening', startTime: '06:00', endTime: '10:00' },
    { period: 'midday', label: 'Midday', startTime: '11:00', endTime: '15:00' },
    { period: 'evening', label: 'Evening', startTime: '16:00', endTime: '20:00' },
    { period: 'closing', label: 'Closing', startTime: '21:00', endTime: '23:30' },
  ],
  chilledDeliveryMaxTemp: DELIVERY_LIMITS.chilled,
  frozenDeliveryMaxTemp: DELIVERY_LIMITS.frozen,
}

const staff: StaffMember[] = [
  { id: 'st_amara', name: 'Amara Okafor', role: 'manager', initials: 'AO', active: true, pin: '1042' },
  { id: 'st_tom', name: 'Tom Whitfield', role: 'head_chef', initials: 'TW', active: true, pin: '2288' },
  { id: 'st_lena', name: 'Lena Ferreira', role: 'chef', initials: 'LF', active: true, pin: '3317' },
  { id: 'st_marcus', name: 'Marcus Bell', role: 'chef', initials: 'MB', active: true, pin: '4409' },
  { id: 'st_priya', name: 'Priya Raman', role: 'supervisor', initials: 'PR', active: true, pin: '5521' },
  { id: 'st_joe', name: 'Joe Adeyemi', role: 'front_of_house', initials: 'JA', active: true, pin: '6634' },
  { id: 'st_sofia', name: 'Sofia Lindqvist', role: 'kp', initials: 'SL', active: true, pin: '7746' },
  { id: 'st_daniel', name: 'Daniel Ross', role: 'chef', initials: 'DR', active: false },
]

const kitchenStaff = staff.filter((person) => person.active && person.role !== 'front_of_house')

const items: MonitoredItem[] = [
  // Fridges
  { id: 'eq_wif1', name: 'Walk-in Fridge 1', category: 'fridge', location: 'Main Kitchen', ...SAFE_RANGES.fridge, requiredChecks: ['opening', 'midday', 'closing'], active: true, reference: 'Foster HR400' },
  { id: 'eq_wif2', name: 'Walk-in Fridge 2', category: 'fridge', location: 'Back Store', ...SAFE_RANGES.fridge, requiredChecks: ['opening', 'closing'], active: true, reference: 'Foster HR400' },
  { id: 'eq_larder', name: 'Larder Prep Fridge', category: 'fridge', location: 'Larder Section', ...SAFE_RANGES.fridge, requiredChecks: ['opening', 'evening'], active: true },
  { id: 'eq_dairy', name: 'Dairy Fridge', category: 'fridge', location: 'Main Kitchen', minTemp: 0, maxTemp: 4, requiredChecks: ['opening', 'closing'], active: true },
  { id: 'eq_fish', name: 'Fish Fridge', category: 'fridge', location: 'Main Kitchen', minTemp: 0, maxTemp: 2, requiredChecks: ['opening', 'midday', 'closing'], active: true, notes: 'Tighter range — raw fish held on ice.' },
  { id: 'eq_bar', name: 'Bar Under-counter', category: 'fridge', location: 'Bar', minTemp: 1, maxTemp: 6, requiredChecks: ['opening', 'closing'], active: true },
  // Freezers
  { id: 'eq_wfz', name: 'Walk-in Freezer', category: 'freezer', location: 'Back Store', ...SAFE_RANGES.freezer, requiredChecks: ['opening', 'closing'], active: true, reference: 'Gram F1400' },
  { id: 'eq_ufz', name: 'Under-counter Freezer', category: 'freezer', location: 'Main Kitchen', ...SAFE_RANGES.freezer, requiredChecks: ['opening', 'closing'], active: true },
  { id: 'eq_icefz', name: 'Ice Cream Freezer', category: 'freezer', location: 'Pastry Section', minTemp: -25, maxTemp: -18, requiredChecks: ['opening'], active: true },
  // Display fridges
  { id: 'eq_dess', name: 'Dessert Display', category: 'display_fridge', location: 'Pass', ...SAFE_RANGES.display_fridge, requiredChecks: ['opening', 'midday', 'evening'], active: true },
  { id: 'eq_grab', name: 'Grab & Go Display', category: 'display_fridge', location: 'Front of House', ...SAFE_RANGES.display_fridge, requiredChecks: ['opening', 'midday', 'closing'], active: true },
  // Hot holding
  { id: 'eq_bain1', name: 'Bain Marie — Mains', category: 'hot_holding', location: 'Pass', ...SAFE_RANGES.hot_holding, requiredChecks: ['midday', 'evening'], active: true },
  { id: 'eq_bain2', name: 'Bain Marie — Sides', category: 'hot_holding', location: 'Pass', ...SAFE_RANGES.hot_holding, requiredChecks: ['midday', 'evening'], active: true },
  { id: 'eq_soup', name: 'Soup Kettle', category: 'hot_holding', location: 'Servery', ...SAFE_RANGES.hot_holding, requiredChecks: ['midday'], active: true },
  { id: 'eq_carvery', name: 'Carvery Hot Cabinet', category: 'hot_holding', location: 'Servery', ...SAFE_RANGES.hot_holding, requiredChecks: ['midday', 'evening'], active: true },
  // Cooking probes — ad hoc, per batch
  { id: 'ck_chicken', name: 'Roast Chicken', category: 'cooking', location: 'Main Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], active: true },
  { id: 'ck_burger', name: 'Beef Burger', category: 'cooking', location: 'Grill', ...SAFE_RANGES.cooking, requiredChecks: [], active: true },
  { id: 'ck_pork', name: 'Pork Belly', category: 'cooking', location: 'Main Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], active: true },
  { id: 'ck_pie', name: 'Steak & Ale Pie', category: 'cooking', location: 'Main Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], active: true },
  { id: 'ck_reheat', name: 'Reheated Sauces', category: 'cooking', location: 'Main Kitchen', ...SAFE_RANGES.cooking, requiredChecks: [], active: true },
  { id: 'ck_fish', name: 'Pan-fried Sea Bass', category: 'cooking', location: 'Grill', ...SAFE_RANGES.cooking, requiredChecks: [], active: true },
  // Cooling
  { id: 'cl_rice', name: 'Cooked Rice (cooling)', category: 'cooling', location: 'Blast Chiller', ...SAFE_RANGES.cooling, requiredChecks: [], active: true, notes: 'Must reach 8°C or below within 90 minutes.' },
  { id: 'cl_stock', name: 'Beef Stock (cooling)', category: 'cooling', location: 'Blast Chiller', ...SAFE_RANGES.cooling, requiredChecks: [], active: true },
]

const suppliers: Supplier[] = [
  { id: 'sup_meat', name: 'Harrow & Sons Butchers', categories: ['chilled'], contactName: 'Ray Harrow', phone: '0161 224 8890', active: true },
  { id: 'sup_fish', name: 'Northern Catch Seafood', categories: ['chilled', 'frozen'], contactName: 'Ellie Grant', phone: '0151 332 1120', active: true },
  { id: 'sup_produce', name: 'Greenfield Produce', categories: ['produce'], contactName: 'Sam Doyle', phone: '0161 440 2231', active: true },
  { id: 'sup_dairy', name: 'Pennine Dairy Co.', categories: ['chilled'], contactName: 'Marie Cullen', phone: '01706 551 220', active: true },
  { id: 'sup_dry', name: 'Cater-Direct Wholesale', categories: ['ambient', 'frozen', 'non_food'], contactName: 'Depot Line', phone: '0800 118 2200', active: true },
  { id: 'sup_bakery', name: 'Oakfield Bakery', categories: ['bakery'], contactName: 'Jonah Pike', phone: '0161 909 4412', active: true },
]

const productsBySupplier: Record<string, Array<Omit<DeliveryLine, 'id' | 'accepted' | 'temperature' | 'packaging'>>> = {
  sup_meat: [
    { product: 'Chicken breast, skin-on', category: 'chilled', quantity: 12, unit: 'kg' },
    { product: 'Beef mince 20%', category: 'chilled', quantity: 15, unit: 'kg' },
    { product: 'Pork belly, boneless', category: 'chilled', quantity: 8, unit: 'kg' },
    { product: 'Dry-aged sirloin', category: 'chilled', quantity: 6, unit: 'kg' },
  ],
  sup_fish: [
    { product: 'Sea bass fillets', category: 'chilled', quantity: 7, unit: 'kg' },
    { product: 'Cold-water prawns', category: 'frozen', quantity: 5, unit: 'kg' },
    { product: 'Scottish salmon side', category: 'chilled', quantity: 9, unit: 'kg' },
  ],
  sup_produce: [
    { product: 'Baby spinach', category: 'produce', quantity: 4, unit: 'kg' },
    { product: 'Vine tomatoes', category: 'produce', quantity: 10, unit: 'kg' },
    { product: 'Maris Piper potatoes', category: 'produce', quantity: 25, unit: 'kg' },
    { product: 'Mixed herbs', category: 'produce', quantity: 1.5, unit: 'kg' },
  ],
  sup_dairy: [
    { product: 'Whole milk', category: 'chilled', quantity: 48, unit: 'litres' },
    { product: 'Double cream', category: 'chilled', quantity: 12, unit: 'litres' },
    { product: 'Unsalted butter', category: 'chilled', quantity: 10, unit: 'kg' },
    { product: 'Mature cheddar', category: 'chilled', quantity: 6, unit: 'kg' },
  ],
  sup_dry: [
    { product: 'Rapeseed oil 20L', category: 'ambient', quantity: 2, unit: 'drums' },
    { product: 'Plain flour', category: 'ambient', quantity: 16, unit: 'kg' },
    { product: 'Skin-on fries', category: 'frozen', quantity: 20, unit: 'kg' },
    { product: 'Blue roll', category: 'non_food', quantity: 12, unit: 'rolls' },
  ],
  sup_bakery: [
    { product: 'Brioche buns', category: 'bakery', quantity: 120, unit: 'units' },
    { product: 'Sourdough loaves', category: 'bakery', quantity: 24, unit: 'units' },
  ],
}

const checklistTemplates: ChecklistTemplate[] = [
  {
    id: 'ct_open', name: 'Kitchen Opening Checks', type: 'opening', period: 'opening', area: 'Kitchen', active: true,
    items: [
      { id: 'ci_o1', label: 'All fridge and freezer temperatures recorded', critical: true },
      { id: 'ci_o2', label: 'Hand wash stations stocked (soap, paper, hot water)', critical: true },
      { id: 'ci_o3', label: 'Probe thermometer calibrated and sanitised', hint: 'Ice-water test: must read 0°C ± 1°C', critical: true },
      { id: 'ci_o4', label: 'No signs of pest activity', critical: true },
      { id: 'ci_o5', label: 'Surfaces and equipment clean from previous night', critical: false },
      { id: 'ci_o6', label: 'Staff fit to work and in clean uniform', critical: false },
      { id: 'ci_o7', label: 'Chemicals stored correctly and labelled', critical: false },
    ],
  },
  {
    id: 'ct_close', name: 'Kitchen Closing Checks', type: 'closing', period: 'closing', area: 'Kitchen', active: true,
    items: [
      { id: 'ci_c1', label: 'All high-risk food date-labelled and stored correctly', critical: true },
      { id: 'ci_c2', label: 'Hot holding units emptied and switched off', critical: true },
      { id: 'ci_c3', label: 'Closing temperatures recorded', critical: true },
      { id: 'ci_c4', label: 'Waste removed and bin area clean', critical: false },
      { id: 'ci_c5', label: 'Floors swept and mopped', critical: false },
      { id: 'ci_c6', label: 'Gas and electrical equipment isolated', critical: false },
    ],
  },
  {
    id: 'ct_fs', name: 'Daily Food Safety Review', type: 'food_safety', period: 'evening', area: 'Kitchen', active: true,
    items: [
      { id: 'ci_f1', label: 'Raw and ready-to-eat separated at all stages', critical: true },
      { id: 'ci_f2', label: 'All date labels in date — nothing past use-by', critical: true },
      { id: 'ci_f3', label: 'Allergen matrix up to date and accessible', critical: true },
      { id: 'ci_f4', label: 'Cooling records completed for batch-cooked items', critical: false },
      { id: 'ci_f5', label: 'Colour-coded boards and knives used correctly', critical: false },
    ],
  },
  {
    id: 'ct_clean_kitchen', name: 'Kitchen Deep Clean', type: 'cleaning', period: 'closing', area: 'Main Kitchen', active: true,
    items: [
      { id: 'ci_k1', label: 'Extraction canopy filters degreased', critical: false },
      { id: 'ci_k2', label: 'Ovens and grills cleaned', critical: false },
      { id: 'ci_k3', label: 'Fridge seals and handles sanitised', critical: false },
      { id: 'ci_k4', label: 'Floor drains flushed', critical: false },
      { id: 'ci_k5', label: 'Under-counter areas cleared and mopped', critical: false },
    ],
  },
  {
    id: 'ct_clean_foh', name: 'Front of House Clean', type: 'cleaning', period: 'closing', area: 'Front of House', active: true,
    items: [
      { id: 'ci_fh1', label: 'Tables and high-touch points sanitised', critical: false },
      { id: 'ci_fh2', label: 'Toilets cleaned and restocked', critical: false },
      { id: 'ci_fh3', label: 'Bar surfaces and taps cleaned', critical: false },
      { id: 'ci_fh4', label: 'Ice machine wiped and scoop stored correctly', critical: true },
    ],
  },
]

const stock: StockItem[] = [
  { id: 'sk_1', name: 'Chicken breast, skin-on', category: 'meat', unit: 'kg', quantity: 8.5, parLevel: 12, location: 'Walk-in Fridge 1', supplierId: 'sup_meat', costPerUnit: 7.4 },
  { id: 'sk_2', name: 'Beef mince 20%', category: 'meat', unit: 'kg', quantity: 14, parLevel: 10, location: 'Walk-in Fridge 1', supplierId: 'sup_meat', costPerUnit: 6.2 },
  { id: 'sk_3', name: 'Pork belly, boneless', category: 'meat', unit: 'kg', quantity: 3, parLevel: 6, location: 'Walk-in Fridge 2', supplierId: 'sup_meat', costPerUnit: 5.8 },
  { id: 'sk_4', name: 'Sea bass fillets', category: 'fish', unit: 'kg', quantity: 4.2, parLevel: 5, location: 'Fish Fridge', supplierId: 'sup_fish', costPerUnit: 18.5 },
  { id: 'sk_5', name: 'Scottish salmon side', category: 'fish', unit: 'kg', quantity: 6, parLevel: 4, location: 'Fish Fridge', supplierId: 'sup_fish', costPerUnit: 16.9 },
  { id: 'sk_6', name: 'Cold-water prawns', category: 'frozen', unit: 'kg', quantity: 2.5, parLevel: 4, location: 'Walk-in Freezer', supplierId: 'sup_fish', costPerUnit: 14.2 },
  { id: 'sk_7', name: 'Whole milk', category: 'dairy', unit: 'litres', quantity: 34, parLevel: 30, location: 'Dairy Fridge', supplierId: 'sup_dairy', costPerUnit: 1.05 },
  { id: 'sk_8', name: 'Double cream', category: 'dairy', unit: 'litres', quantity: 5, parLevel: 8, location: 'Dairy Fridge', supplierId: 'sup_dairy', costPerUnit: 2.6 },
  { id: 'sk_9', name: 'Unsalted butter', category: 'dairy', unit: 'kg', quantity: 9, parLevel: 6, location: 'Dairy Fridge', supplierId: 'sup_dairy', costPerUnit: 6.1 },
  { id: 'sk_10', name: 'Mature cheddar', category: 'dairy', unit: 'kg', quantity: 4.5, parLevel: 4, location: 'Dairy Fridge', supplierId: 'sup_dairy', costPerUnit: 8.3 },
  { id: 'sk_11', name: 'Maris Piper potatoes', category: 'produce', unit: 'kg', quantity: 42, parLevel: 25, location: 'Dry Store', supplierId: 'sup_produce', costPerUnit: 0.9 },
  { id: 'sk_12', name: 'Baby spinach', category: 'produce', unit: 'kg', quantity: 1.2, parLevel: 3, location: 'Larder Prep Fridge', supplierId: 'sup_produce', costPerUnit: 5.4 },
  { id: 'sk_13', name: 'Vine tomatoes', category: 'produce', unit: 'kg', quantity: 7, parLevel: 6, location: 'Larder Prep Fridge', supplierId: 'sup_produce', costPerUnit: 3.1 },
  { id: 'sk_14', name: 'Plain flour', category: 'dry', unit: 'kg', quantity: 22, parLevel: 15, location: 'Dry Store', supplierId: 'sup_dry', costPerUnit: 1.2 },
  { id: 'sk_15', name: 'Rapeseed oil 20L', category: 'dry', unit: 'drums', quantity: 1, parLevel: 2, location: 'Dry Store', supplierId: 'sup_dry', costPerUnit: 28 },
  { id: 'sk_16', name: 'Skin-on fries', category: 'frozen', unit: 'kg', quantity: 18, parLevel: 20, location: 'Walk-in Freezer', supplierId: 'sup_dry', costPerUnit: 2.4 },
  { id: 'sk_17', name: 'Brioche buns', category: 'dry', unit: 'units', quantity: 64, parLevel: 80, location: 'Dry Store', supplierId: 'sup_bakery', costPerUnit: 0.42 },
  { id: 'sk_18', name: 'Blue roll', category: 'packaging', unit: 'rolls', quantity: 9, parLevel: 6, location: 'Dry Store', supplierId: 'sup_dry', costPerUnit: 2.1 },
  { id: 'sk_19', name: 'House red wine', category: 'drinks', unit: 'bottles', quantity: 24, parLevel: 18, location: 'Bar Store', costPerUnit: 6.5 },
  { id: 'sk_20', name: 'Vanilla ice cream', category: 'frozen', unit: 'litres', quantity: 6, parLevel: 8, location: 'Ice Cream Freezer', supplierId: 'sup_dry', costPerUnit: 4.8 },
]

/* -------------------------------------------------------------------------- */
/* Generated history                                                           */
/* -------------------------------------------------------------------------- */

const HISTORY_DAYS = 14

/** Samples a reading for an item: usually comfortably inside range, sometimes not. */
function sampleTemperature(item: MonitoredItem, forceFail: boolean): number {
  const { minTemp: min, maxTemp: max } = item

  if (min !== null && max !== null) {
    if (forceFail) {
      return chance(0.7) ? roundTo(max + between(0.4, 3.2)) : roundTo(min - between(0.4, 2.5))
    }
    const span = max - min
    return roundTo(min + span * between(0.2, 0.8))
  }
  if (min !== null) {
    // Hot holding / cooking — fail means it dipped below the minimum.
    return forceFail ? roundTo(min - between(0.5, 5)) : roundTo(min + between(1.5, 14))
  }
  if (max !== null) {
    return forceFail ? roundTo(max + between(0.5, 4)) : roundTo(max - between(1, 5))
  }
  return roundTo(between(0, 10))
}

function buildTemperatureLogs(now: Date): TemperatureLog[] {
  const logs: TemperatureLog[] = []

  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = subDays(now, dayOffset)
    const isToday = dayOffset === 0

    for (const item of items) {
      if (!item.active) continue

      for (const period of item.requiredChecks) {
        const window = DEFAULT_SETTINGS.periods.find((w) => w.period === period)
        if (!window) continue
        const { start, end } = periodInterval(window, day)

        // Today: only periods that have already opened can have been logged,
        // and we leave a few genuinely missing so the board isn't all green.
        if (isToday && now < start) continue
        const completionOdds = isToday ? (now > end ? 0.82 : 0.6) : 0.97
        if (!chance(completionOdds)) continue

        const windowMinutes = Math.max(15, (end.getTime() - start.getTime()) / 60000)
        const recordedAt = addMinutes(start, Math.floor(between(5, Math.min(windowMinutes - 5, 180))))
        if (recordedAt > now) continue

        const forceFail = chance(0.045)
        const temperature = sampleTemperature(item, forceFail)
        const outcome = evaluateTemperature(item, temperature)

        logs.push({
          id: createId('tl'),
          itemId: item.id,
          temperature,
          recordedAt: recordedAt.toISOString(),
          recordedBy: pick(kitchenStaff).id,
          outcome,
          period,
          correctiveAction:
            outcome === 'fail'
              ? pick([
                  'Moved stock to Walk-in Fridge 2 and called engineer.',
                  'Door found ajar — closed and re-checked after 30 minutes.',
                  'Unit turned down; re-probed after 45 minutes and within range.',
                  'Affected stock discarded and recorded on waste sheet.',
                ])
              : undefined,
        })
      }

      // Ad-hoc probes: cooking and cooling records happen per batch.
      if (item.category === 'cooking' || item.category === 'cooling') {
        const batches = item.category === 'cooking' ? Math.floor(between(1, 4)) : Math.floor(between(0, 2))
        for (let batch = 0; batch < batches; batch += 1) {
          const recordedAt = new Date(day)
          recordedAt.setHours(Math.floor(between(10, 21)), Math.floor(between(0, 59)), 0, 0)
          if (recordedAt > now) continue

          const forceFail = chance(0.05)
          const temperature = sampleTemperature(item, forceFail)
          const outcome = evaluateTemperature(item, temperature)

          logs.push({
            id: createId('tl'),
            itemId: item.id,
            temperature,
            recordedAt: recordedAt.toISOString(),
            recordedBy: pick(kitchenStaff).id,
            outcome,
            correctiveAction:
              outcome === 'fail'
                ? item.category === 'cooking'
                  ? 'Returned to oven for a further 8 minutes and re-probed at 79.2°C.'
                  : 'Split into shallow trays and blast-chilled; reached 6°C at 85 minutes.'
                : undefined,
            notes: item.category === 'cooking' ? pick(['Core probe, thickest part', 'Probed 2 pieces from the batch', undefined, undefined]) : undefined,
          })
        }
      }
    }
  }

  return logs.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

function buildDeliveries(now: Date): Delivery[] {
  const deliveries: Delivery[] = []

  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = subDays(now, dayOffset)
    const count = Math.floor(between(1, 4))

    for (let index = 0; index < count; index += 1) {
      const supplier = pick(suppliers)
      const receivedAt = new Date(day)
      receivedAt.setHours(Math.floor(between(6, 12)), Math.floor(between(0, 59)), 0, 0)
      if (receivedAt > now) continue

      const catalogue = productsBySupplier[supplier.id] ?? []
      const lineCount = Math.max(1, Math.min(catalogue.length, Math.floor(between(1, catalogue.length + 1))))
      const chosen = [...catalogue].sort(() => rand() - 0.5).slice(0, lineCount)

      const lines: DeliveryLine[] = chosen.map((entry) => {
        const isChilled = entry.category === 'chilled' || entry.category === 'produce' || entry.category === 'bakery'
        const isFrozen = entry.category === 'frozen'
        const problem = chance(0.07)

        let temperature: number | null = null
        if (isChilled) temperature = problem ? roundTo(between(8.5, 12)) : roundTo(between(1, 6.5))
        else if (isFrozen) temperature = problem ? roundTo(between(-13, -9)) : roundTo(between(-22, -16))

        const packaging: DeliveryLine['packaging'] = problem && !isChilled && !isFrozen ? 'damaged' : chance(0.03) ? 'damaged' : 'good'
        const accepted = !(problem || packaging !== 'good')

        return {
          id: createId('dl'),
          ...entry,
          quantity: roundTo(entry.quantity * between(0.8, 1.2), 1),
          temperature,
          packaging,
          accepted,
          useBy: isChilled ? toISODate(addDays(receivedAt, Math.floor(between(3, 8)))) : undefined,
          bestBefore: !isChilled ? toISODate(addDays(receivedAt, Math.floor(between(30, 240)))) : undefined,
          rejectionReason: accepted
            ? undefined
            : packaging !== 'good'
              ? 'Outer packaging damaged in transit — refused and credited.'
              : isFrozen
                ? 'Frozen goods above -15°C on arrival — signs of thawing.'
                : 'Chilled goods above 8°C on arrival.',
        }
      })

      deliveries.push({
        id: createId('dv'),
        supplierId: supplier.id,
        receivedAt: receivedAt.toISOString(),
        checkedBy: pick(kitchenStaff).id,
        status: deriveDeliveryStatus(lines),
        lines,
        deliveryNote: `DN-${Math.floor(between(10000, 99999))}`,
        driverName: pick(['Kev M.', 'Sandra P.', 'Ibrahim K.', 'Dave L.', 'Nina R.']),
        vehicleTempOk: chance(0.96),
      })
    }
  }

  return deliveries.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
}

function buildChecklistRuns(now: Date): ChecklistRun[] {
  const runs: ChecklistRun[] = []

  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = subDays(now, dayOffset)
    const isToday = dayOffset === 0

    for (const template of checklistTemplates) {
      const window = DEFAULT_SETTINGS.periods.find((w) => w.period === template.period)
      if (!window) continue
      const { start, end } = periodInterval(window, day)
      if (isToday && now < end && !chance(0.4)) continue
      if (!chance(isToday ? 0.7 : 0.94)) continue

      const completedAt = addMinutes(start, Math.floor(between(10, 120)))
      if (completedAt > now) continue

      runs.push({
        id: createId('cr'),
        templateId: template.id,
        date: toISODate(day),
        completedBy: pick(kitchenStaff).id,
        completedAt: completedAt.toISOString(),
        results: template.items.map((item) => ({
          itemId: item.id,
          status: chance(0.965) ? 'pass' : chance(0.5) ? 'fail' : 'na',
          note: undefined,
        })),
      })
    }
  }

  return runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
}

function buildIssues(now: Date, logs: TemperatureLog[], deliveries: Delivery[]): FoodSafetyIssue[] {
  const issues: FoodSafetyIssue[] = []

  // Escalate a handful of recent temperature failures into tracked issues.
  const recentFailures = logs.filter((log) => log.outcome === 'fail').slice(0, 4)
  for (const [index, log] of recentFailures.entries()) {
    const item = items.find((entry) => entry.id === log.itemId)
    if (!item) continue
    issues.push({
      id: createId('is'),
      title: `${item.name} out of range at ${log.temperature}°C`,
      description:
        log.correctiveAction ??
        'Reading outside the safe range. Stock checked and corrective action recorded at the time.',
      severity: index === 0 ? 'high' : index < 2 ? 'medium' : 'low',
      status: index === 0 ? 'open' : index === 1 ? 'in_progress' : 'resolved',
      source: 'temperature',
      raisedAt: log.recordedAt,
      raisedBy: log.recordedBy,
      assigneeId: 'st_tom',
      linkedRecordId: log.id,
      resolution: index >= 2 ? 'Engineer attended, thermostat recalibrated. Monitored for 48 hours.' : undefined,
      resolvedAt: index >= 2 ? addMinutes(new Date(log.recordedAt), 600).toISOString() : undefined,
    })
  }

  const rejected = deliveries.find((delivery) => delivery.status !== 'accepted')
  if (rejected) {
    const supplier = suppliers.find((entry) => entry.id === rejected.supplierId)
    issues.push({
      id: createId('is'),
      title: `Repeat temperature failures from ${supplier?.name ?? 'supplier'}`,
      description:
        'Third chilled delivery this month arriving above 8°C. Supplier contacted; asking for vehicle calibration records before the next drop.',
      severity: 'medium',
      status: 'in_progress',
      source: 'delivery',
      raisedAt: rejected.receivedAt,
      raisedBy: 'st_amara',
      assigneeId: 'st_amara',
      linkedRecordId: rejected.id,
    })
  }

  issues.push({
    id: createId('is'),
    title: 'Chipped chopping board in larder section',
    description:
      'Green board has a deep score that cannot be cleaned effectively. Removed from service and replacement ordered.',
    severity: 'low',
    status: 'resolved',
    source: 'manual',
    raisedAt: subDays(now, 5).toISOString(),
    raisedBy: 'st_lena',
    assigneeId: 'st_tom',
    resolution: 'Board destroyed, replacement received 12 Sep.',
    resolvedAt: subDays(now, 3).toISOString(),
  })

  return issues.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
}

function buildTasks(now: Date): Task[] {
  const base: Array<Omit<Task, 'id' | 'createdAt'>> = [
    { title: 'Book annual extraction canopy deep clean', description: 'Certificate expires end of the month — needs a dated invoice for the EHO file.', assigneeId: 'st_amara', dueAt: addDays(now, 2).toISOString(), priority: 'high', status: 'todo', category: 'compliance' },
    { title: 'Re-calibrate all probe thermometers', description: 'Ice-water and boiling-point test, log results on the calibration sheet.', assigneeId: 'st_tom', dueAt: addDays(now, 1).toISOString(), priority: 'high', status: 'in_progress', category: 'compliance' },
    { title: 'Walk-in Fridge 2 — engineer visit', description: 'Intermittent temperature spikes overnight. Engineer booked for Thursday AM.', assigneeId: 'st_tom', dueAt: addDays(now, 3).toISOString(), priority: 'high', status: 'todo', category: 'maintenance' },
    { title: 'Update allergen matrix for new autumn menu', assigneeId: 'st_lena', dueAt: subDays(now, 1).toISOString(), priority: 'high', status: 'todo', category: 'compliance' },
    { title: 'Level 2 Food Hygiene refresher — Marcus & Sofia', assigneeId: 'st_amara', dueAt: addDays(now, 9).toISOString(), priority: 'normal', status: 'todo', category: 'training' },
    { title: 'Monthly full stock count', assigneeId: 'st_priya', dueAt: addDays(now, 5).toISOString(), priority: 'normal', status: 'todo', category: 'admin' },
    { title: 'Replace door seal on Under-counter Freezer', assigneeId: 'st_marcus', dueAt: addDays(now, 4).toISOString(), priority: 'normal', status: 'todo', category: 'maintenance' },
    { title: 'Prep: 20L beef stock for weekend service', assigneeId: 'st_marcus', dueAt: addDays(now, 1).toISOString(), priority: 'normal', status: 'in_progress', category: 'prep' },
    { title: 'Order replacement colour-coded boards', assigneeId: 'st_lena', dueAt: subDays(now, 2).toISOString(), priority: 'low', status: 'done', category: 'admin', completedAt: subDays(now, 2).toISOString() },
    { title: 'File last month’s pest control report', assigneeId: 'st_amara', dueAt: subDays(now, 4).toISOString(), priority: 'normal', status: 'done', category: 'compliance', completedAt: subDays(now, 4).toISOString() },
    { title: 'Deep clean ice machine', assigneeId: 'st_sofia', dueAt: addDays(now, 6).toISOString(), priority: 'normal', status: 'todo', category: 'maintenance' },
    { title: 'Review supplier temperature performance', description: 'Northern Catch and Greenfield both had rejections this fortnight.', assigneeId: 'st_amara', dueAt: addDays(now, 7).toISOString(), priority: 'low', status: 'todo', category: 'admin' },
  ]

  return base.map((task, index) => ({
    ...task,
    id: createId('tk'),
    createdAt: subDays(now, 10 - (index % 8)).toISOString(),
  }))
}

/* -------------------------------------------------------------------------- */

/** Builds a complete demo dataset relative to `now`. */
export function createSeedData(now: Date = new Date()): AppData {
  const temperatureLogs = buildTemperatureLogs(now)
  const deliveries = buildDeliveries(now)

  return {
    staff,
    items,
    temperatureLogs,
    suppliers,
    deliveries,
    checklistTemplates,
    checklistRuns: buildChecklistRuns(now),
    issues: buildIssues(now, temperatureLogs, deliveries),
    stock: stock.map((entry) => ({
      ...entry,
      // Hours rather than whole days, so no item reads as "counted 3 seconds ago".
      lastCountedAt: subHours(now, Math.floor(between(5, 220))).toISOString(),
      lastCountedBy: pick(kitchenStaff).id,
    })),
    tasks: buildTasks(now),
    settings: DEFAULT_SETTINGS,
  }
}
