/**
 * The starter library of task templates, from the Trail build map in Figma.
 *
 * Names, groups, schedules and tags follow the design; the tasks and questions
 * inside each are a sensible starting point a venue is expected to edit. Built
 * on demand with fresh ids for everything below the template, so adding the
 * library twice (say, on two devices) only ever upserts the same templates.
 */
import { createId } from '@/lib/utils'
import { newOption, newQuestion, type OptionSpec } from './taskQuestions'
import type {
  TaskCategory,
  TaskPriority,
  TaskQuestion,
  TaskTemplate,
  TemplateTask,
} from './types'

/** The order groups are listed in, through the trading day. */
export const TEMPLATE_GROUPS = [
  'Before open',
  'Open',
  'Morning',
  'Evening',
  'Close',
  'After close',
  'All day',
  'Over several days',
  'Multiple schedules',
  'Ad hoc',
] as const

/* Builders ------------------------------------------------------------------ */

interface QuestionExtras {
  hint?: string
  mandatory?: boolean
  scored?: boolean
}

/** Yes is the good answer; No logs an exception and needs a note on what was done. */
function yesNo(label: string, extras: QuestionExtras = {}): TaskQuestion {
  return { ...newQuestion('options', label), ...extras }
}

function choice(label: string, options: (string | OptionSpec)[], extras: QuestionExtras = {}): TaskQuestion {
  return {
    ...newQuestion('options', label),
    options: options.map((option) => newOption(typeof option === 'string' ? { label: option } : option)),
    display: options.length > 4 ? 'dropdown' : 'buttons',
    ...extras,
  }
}

/** A °C reading; anything outside `min`–`max` is an exception. */
function temp(label: string, min: number | undefined, max: number | undefined, extras: QuestionExtras = {}): TaskQuestion {
  return { ...newQuestion('number', label), unit: '°C', min, max, ...extras }
}

function amount(label: string, unit: string, extras: QuestionExtras & { min?: number; max?: number } = {}): TaskQuestion {
  return { ...newQuestion('number', label), unit, ...extras }
}

function text(label: string, extras: QuestionExtras = {}): TaskQuestion {
  return { ...newQuestion('text', label), ...extras }
}

/** Optional free-text notes, the usual last question. */
function notes(label = 'Anything to report?'): TaskQuestion {
  return text(label, { mandatory: false })
}

function check(label: string, extras: QuestionExtras = {}): TaskQuestion {
  return { ...newQuestion('check', label), ...extras }
}

interface TaskExtras {
  description?: string
  category?: TaskCategory
  priority?: TaskPriority
}

function task(title: string, questions: TaskQuestion[], extras: TaskExtras = {}): TemplateTask {
  return {
    id: createId('tt'),
    title,
    description: extras.description,
    category: extras.category ?? 'compliance',
    priority: extras.priority ?? 'normal',
    questions,
  }
}

export function newTemplateTask(title = ''): TemplateTask {
  return task(title, [])
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function template(
  icon: string,
  name: string,
  group: (typeof TEMPLATE_GROUPS)[number],
  schedule: string | undefined,
  tags: string[],
  tasks: TemplateTask[],
): TaskTemplate {
  return { id: `lib-${slug(name)}`, name, icon, group, schedule, tags, tasks }
}

/* Shared question sets ------------------------------------------------------ */

const cleanCondition = (area: string) =>
  choice(`Condition of the ${area}`, [
    { label: 'Clean', score: 2 },
    { label: 'Needs attention', score: 1, action: 'request' },
    { label: 'Dirty', exception: true, action: 'require' },
  ], { scored: true })

const fridgeReading = (name: string) => temp(`${name} temperature`, -1, 5, { hint: 'Air or product probe. Above 5°C needs action.' })
const freezerReading = (name: string) => temp(`${name} temperature`, undefined, -18, { hint: 'Should be −18°C or colder.' })

/* The library --------------------------------------------------------------- */

export function createTemplateLibrary(): TaskTemplate[] {
  return [
    /* Before open ---------------------------------------------------------- */
    template('🔎', 'Manager Opening Checks', 'Before open', 'Every day in Before open', [], [
      task('Walk the site before opening', [
        yesNo('Alarm disarmed and all doors secure on arrival?'),
        yesNo('Any signs of a break-in or damage?', { hint: 'Answer No if everything is as it was left.' }),
        yesNo('Lights, heating and ventilation working?'),
        yesNo('Fire exits clear and unlocked?'),
        notes(),
      ]),
      task('Check today’s team and bookings', [
        yesNo('Everyone on the rota has arrived or been accounted for?'),
        amount('Covers booked for today', 'covers', { mandatory: false }),
        yesNo('Allergen and special requests passed to the kitchen?'),
      ], { category: 'admin' }),
    ]),
    template('🌡', 'Cellar Temperature Records', 'Before open', 'Every day in Before open', [], [
      task('Record the cellar temperature', [
        temp('Cellar temperature', 11, 13, { hint: 'Keep cask ale between 11°C and 13°C.' }),
        yesNo('Cellar cooling unit running normally?'),
        yesNo('Cellar floor clean and dry?'),
        notes(),
      ]),
    ]),
    template('☕️', 'Coffee Brew Records', 'Before open', 'Every day in Before open', [], [
      task('Dial in the espresso', [
        amount('Dose', 'g', { min: 16, max: 22 }),
        amount('Yield', 'g', { min: 32, max: 48 }),
        amount('Extraction time', 's', { min: 25, max: 32 }),
        choice('Taste', [{ label: 'Balanced' }, { label: 'Sour', action: 'request' }, { label: 'Bitter', action: 'request' }]),
        notes('Grind or recipe changes made'),
      ], { category: 'prep' }),
    ]),
    template('😷', 'COVID-19 Team Health Records', 'Before open', 'Every day in Before open', ['COVID-19'], [
      task('Team health check', [
        yesNo('Has everyone on shift confirmed they are free of symptoms?'),
        yesNo('Anyone told to stay at home today?', { mandatory: false }),
        text('Names of anyone sent home', { mandatory: false }),
      ]),
    ]),

    /* Open ----------------------------------------------------------------- */
    template('🍔', 'Opening Checks - Food Safety', 'Open', 'Every day in Open', ['Food Safety'], [
      task('Food safety opening checks', [
        yesNo('Fridges and freezers at the right temperature?'),
        yesNo('Probe thermometer clean, wipes available and working?'),
        yesNo('Hand-wash sinks stocked with soap and paper towels?'),
        yesNo('All food in date, labelled and covered?'),
        yesNo('Raw and ready-to-eat food stored apart?'),
        notes(),
      ]),
    ]),
    template('🍸', 'Opening Checks - Bar', 'Open', 'Every day in Open', [], [
      task('Set up the bar', [
        yesNo('Ice machine clean and ice scoop stored outside the ice?'),
        yesNo('Glass washer filled, chemicals connected and at temperature?'),
        yesNo('Fridges stocked and at temperature?'),
        yesNo('Garnishes prepped, covered and dated?'),
        yesNo('Float in the till and card machines working?'),
        notes(),
      ], { category: 'prep' }),
    ]),
    template('⛑', 'Opening Checks - Health and Safety', 'Open', 'Every day in Open', [], [
      task('Health and safety walk-round', [
        yesNo('Fire exits and escape routes clear?'),
        yesNo('First aid box stocked?'),
        yesNo('Floors dry and free of trip hazards?'),
        yesNo('Wet floor signs available?'),
        yesNo('Electrical equipment free of visible damage?'),
        notes(),
      ]),
    ]),
    template('🍳', 'Opening Checks - Kitchen', 'Open', 'Every day in Open', ['Kitchen'], [
      task('Kitchen opening checks', [
        yesNo('Gas and extraction on and working?'),
        yesNo('All work surfaces cleaned and sanitised?'),
        yesNo('Chopping boards colour-coded and clean?'),
        yesNo('Mise en place checked and in date?'),
        yesNo('Allergen matrix up to date for today’s menu?'),
        notes(),
      ]),
    ]),
    template('🚰', 'Sink & Hot Water Records', 'Open', 'Every day in Open', ['Health and Safety', 'Kitchen', 'Toilets'], [
      task('Kitchen sinks', [
        temp('Hot water temperature at the kitchen hand-wash sink', 50, undefined),
        yesNo('Soap and paper towels stocked?'),
      ]),
      task('Toilet sinks', [
        temp('Hot water temperature in the toilets', 50, undefined),
        yesNo('Soap and paper towels stocked?'),
        notes(),
      ]),
    ]),
    template('🪑', 'Opening Checks - Indoor Area', 'Open', 'Every day in Open', [], [
      task('Indoor area ready for guests', [
        cleanCondition('dining area'),
        yesNo('Tables laid and menus clean?'),
        yesNo('Lighting and music set?'),
        yesNo('Toilets checked and stocked?'),
        notes(),
      ], { category: 'prep' }),
    ]),
    template('🌳', 'Opening Checks - Outdoor Area', 'Open', 'Every day in Open', [], [
      task('Outdoor area ready for guests', [
        cleanCondition('outdoor area'),
        yesNo('Furniture safe, stable and wiped down?'),
        yesNo('Heaters and umbrellas working?', { mandatory: false }),
        yesNo('Smoking area bins emptied?'),
        notes(),
      ], { category: 'prep' }),
    ]),

    /* Morning -------------------------------------------------------------- */
    template('🚨', 'Weekly Fire Alarm Test Records', 'Morning', 'Every week on Monday in After close', ['Fire Safety'], [
      task('Test the fire alarm', [
        text('Call point tested', { hint: 'Use a different call point each week.' }),
        yesNo('Alarm sounded throughout the building?'),
        yesNo('Alarm panel reset with no faults showing?'),
        notes(),
      ]),
    ]),
    template('🚰', 'Legionella Test Records', 'Morning', 'Every day between Morning and After close', ['Health and Safety'], [
      task('Flush little-used outlets', [
        yesNo('Little-used taps and showers run for 2 minutes?'),
        temp('Hot water at the sentinel outlet', 50, undefined, { hint: 'Should reach 50°C within a minute.' }),
        temp('Cold water at the sentinel outlet', undefined, 20, { hint: 'Should be below 20°C within two minutes.' }),
        notes(),
      ]),
    ]),

    /* Evening -------------------------------------------------------------- */
    template('📝', 'Weekly Manager Report', 'Evening', 'Every week on Friday in After close', [], [
      task('Write up the week', [
        amount('Sales this week', '£', { mandatory: false }),
        amount('Labour hours this week', 'h', { mandatory: false }),
        text('Wins this week'),
        text('Problems and what’s being done about them'),
        yesNo('All compliance records complete for the week?'),
      ], { category: 'admin' }),
    ]),

    /* Close ---------------------------------------------------------------- */
    template('🌙', 'Closing Checks - Kitchen Manager', 'Close', 'Every day between Close and After close', ['Kitchen'], [
      task('Close down the kitchen', [
        yesNo('All food covered, labelled and stored?'),
        yesNo('Hot holding emptied and switched off?'),
        yesNo('Surfaces, floors and equipment cleaned?'),
        yesNo('Gas, fryers and extraction switched off?'),
        yesNo('Bins emptied and lids closed?'),
        notes(),
      ]),
    ]),
    template('🌳', 'Closing Checks - Outdoor Area', 'Close', 'Every day between Close and After close', [], [
      task('Close down the outdoor area', [
        yesNo('Furniture stacked or secured?'),
        yesNo('Heaters and lights switched off?'),
        yesNo('Glasses and litter collected?'),
        yesNo('Gates locked?'),
        notes(),
      ]),
    ]),
    template('👋', 'Closing Checks - FOH', 'Close', 'Every day between Close and After close', ['Brand Standards'], [
      task('Close down front of house', [
        yesNo('Tables cleared, wiped and reset?'),
        yesNo('Tills cashed up and floats bagged?'),
        yesNo('Bar fridges stocked for tomorrow?'),
        yesNo('Glass washer drained and cleaned?'),
        notes(),
      ]),
    ]),
    template('🪑', 'Closing Checks - Indoor Area', 'Close', 'Every day between Close and After close', [], [
      task('Close down the indoor area', [
        cleanCondition('dining area'),
        yesNo('Toilets checked and cleaned?'),
        yesNo('Windows and doors locked?'),
        yesNo('Lights and music off?'),
        notes(),
      ]),
    ]),

    /* After close ---------------------------------------------------------- */
    template('🗑', 'Wastage Records', 'After close', 'Every day in After close', ['Food Safety'], [
      task('Record today’s wastage', [
        text('Items thrown away', { hint: 'One per line, with quantities.' }),
        choice('Main reason', ['Out of date', 'Over-prepped', 'Damaged', 'Returned by guest', 'Temperature failure']),
        amount('Estimated cost', '£', { mandatory: false }),
      ], { category: 'admin' }),
    ]),
    template('🔎', 'Manager Closing Checks', 'After close', 'Every day in After close', ['Manager only', 'Brand Standards'], [
      task('Lock up', [
        yesNo('All staff signed out and off the premises?'),
        yesNo('Cash banked and safe locked?'),
        yesNo('All doors and windows locked?'),
        yesNo('Alarm set?'),
        notes(),
      ], { priority: 'high' }),
      task('Review the day', [
        yesNo('All of today’s checks completed?'),
        text('Handover notes for tomorrow', { mandatory: false }),
      ], { category: 'admin' }),
    ]),
    template('☕️', 'Coffee Grinder Cleaning Checks', 'After close', 'Every day in After close', [], [
      task('Clean the coffee grinder', [
        check('Hopper emptied and wiped'),
        check('Burrs brushed out'),
        check('Grinder cleaning tablets run through'),
        yesNo('Grinder back together and working?'),
      ], { category: 'maintenance' }),
    ]),

    /* All day -------------------------------------------------------------- */
    template('💰', 'Float Count Records', 'All day', 'Every day between Before open and After close', [], [
      task('Count the float', [
        amount('Float counted', '£'),
        amount('Expected float', '£'),
        yesNo('Float matches what’s expected?'),
        notes('Explain any difference'),
      ], { category: 'admin' }),
    ]),
    template('🌡', 'Reheating Temperature Records', 'All day', 'Every day between Before open and After close', ['Reheated Food'], [
      task('Probe reheated food', [
        text('Food reheated'),
        temp('Core temperature', 75, undefined, { hint: 'Reheat to 75°C or above.' }),
        yesNo('Reheated only once?'),
      ]),
    ]),
    template('🍽', 'Dishwasher Checks', 'All day', 'Every day between Before open and After close', [], [
      task('Check the dishwasher', [
        temp('Wash temperature', 55, 65),
        temp('Rinse temperature', 82, undefined),
        yesNo('Detergent and rinse aid levels OK?'),
        yesNo('Filters clean?'),
      ], { category: 'maintenance' }),
    ]),
    template('🌡️', 'Hot Holding Temperature Records', 'All day', 'Every day between Before open and After close', ['Cooked Food'], [
      task('Probe hot-held food', [
        text('Food being held'),
        temp('Core temperature', 63, undefined, { hint: 'Hold at 63°C or above.' }),
        choice('If below 63°C', [
          { label: 'Not applicable' },
          { label: 'Reheated to 75°C', action: 'request' },
          { label: 'Thrown away', exception: true, action: 'require' },
        ]),
      ]),
    ]),
    template('🚛', 'Delivery Records', 'All day', 'Every day between Before open and After close', ['Food Safety'], [
      task('Check a delivery in', [
        text('Supplier'),
        temp('Chilled goods temperature', undefined, 8, { mandatory: false }),
        temp('Frozen goods temperature', undefined, -15, { mandatory: false }),
        yesNo('Packaging undamaged and in date?'),
        yesNo('Everything ordered was delivered?'),
        notes('Rejected items and why'),
      ]),
    ]),
    template('⛑', 'Weekly First Aid Box Checks', 'All day', 'Every week on Friday in After close', ['Health and Safety'], [
      task('Check the first aid box', [
        yesNo('Plasters, including blue catering plasters, stocked?'),
        yesNo('Dressings and bandages stocked?'),
        yesNo('Everything in date?'),
        yesNo('Accident book in place?'),
        notes('Items to reorder'),
      ]),
    ]),
    template('⛑', 'Monthly Fire Extinguisher Records', 'All day', 'Every month on the 22nd between Before open and After close', ['Fire Safety'], [
      task('Inspect the fire extinguishers', [
        yesNo('All extinguishers in place and unobstructed?'),
        yesNo('Pressure gauges in the green?'),
        yesNo('Pins and tamper seals intact?'),
        yesNo('Service labels in date?'),
        notes(),
      ]),
    ]),
    template('🥜', 'Allergen Control Records', 'All day', 'Every day between Before open and After close', ['Food Safety'], [
      task('Allergen order check', [
        text('Table or order'),
        choice('Allergen', ['Celery', 'Cereals with gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin', 'Milk', 'Molluscs', 'Mustard', 'Nuts', 'Peanuts', 'Sesame', 'Soya', 'Sulphites']),
        yesNo('Dish checked against the allergen matrix?'),
        yesNo('Prepared with clean equipment, away from the allergen?'),
        yesNo('Delivered to the table by the person who checked it?'),
      ], { priority: 'high' }),
    ]),
    template('🎛', 'Sous Vide Control Records', 'All day', 'Every day between Before open and After close', [], [
      task('Record a sous vide batch', [
        text('Product'),
        temp('Water bath temperature', undefined, undefined),
        amount('Time in the bath', 'min'),
        temp('Core temperature at the end', 55, undefined),
        yesNo('Chilled rapidly or served straight away?'),
      ], { category: 'prep' }),
    ]),
    template('🌡️', 'Defrosting Records', 'All day', 'Every day between Before open and After close', ['Defrosted Food'], [
      task('Log defrosting food', [
        text('Product'),
        choice('Defrosted in', ['Fridge', 'Cold running water', 'Microwave']),
        temp('Temperature once defrosted', undefined, 5),
        yesNo('Labelled with a use-by date?'),
      ]),
    ]),
    template('🍺', 'Line Cleaning Records', 'All day', 'Every week on Monday in After close', [], [
      task('Clean the beer lines', [
        text('Lines cleaned'),
        yesNo('Cleaning solution left for the recommended time?'),
        yesNo('Lines flushed until the water ran clear?'),
        yesNo('First pint tasted and clear?'),
      ], { category: 'maintenance' }),
    ]),
    template('🍸', 'Pour Test', 'All day', 'Every day between Before open and After close', [], [
      task('Test a bartender’s pour', [
        text('Bartender'),
        amount('Measured pour', 'ml', { min: 23, max: 27 }),
        yesNo('Using a jigger or optic?'),
      ], { category: 'training' }),
    ]),
    template('🧽', 'Weekly Deep Clean', 'All day', 'Every week on Tuesday in After close', [], [
      task('Deep clean the kitchen', [
        check('Behind and under equipment'),
        check('Extraction canopy and filters'),
        check('Walls and tiles'),
        check('Walk-in fridge shelves'),
        cleanCondition('kitchen once finished'),
      ], { category: 'maintenance' }),
      task('Deep clean front of house', [
        check('Skirting boards and corners'),
        check('Under seating and banquettes'),
        check('Light fittings'),
        cleanCondition('dining area once finished'),
      ], { category: 'maintenance' }),
    ]),
    template('🌡', 'Cooling Temperature Records', 'All day', 'Every day between Before open and After close', ['Cooked Food'], [
      task('Log cooling food', [
        text('Food cooling'),
        temp('Temperature after 90 minutes', undefined, 8, { hint: 'Cool to 8°C or below within 90 minutes.' }),
        yesNo('Covered, labelled and in the fridge?'),
      ]),
    ]),

    /* Over several days ---------------------------------------------------- */
    template('⛑', 'Monthly Emergency Lighting Test', 'Over several days', 'Every month between the 1st in Before open and the 7th in After close', ['Fire Safety'], [
      task('Test the emergency lighting', [
        yesNo('All emergency lights came on when tested?'),
        yesNo('All lights back to normal after the test?'),
        text('Faulty fittings', { mandatory: false }),
      ]),
    ]),
    template('🌡', 'Weekly Probe Calibration', 'Over several days', 'Every week between Monday Before open and Sunday After close', ['Cooked Food', 'Reheated Food'], [
      task('Calibrate each probe', [
        text('Probe'),
        temp('Reading in iced water', -1, 1),
        temp('Reading in boiling water', 99, 101),
        yesNo('Probe within ±1°C both times?'),
      ], { category: 'maintenance' }),
    ]),
    template('⛑', 'Monthly Fire Evacuation Drill', 'Over several days', 'Every 3 months between the 1st in Before open and the 28th in After close', ['Fire Safety'], [
      task('Run an evacuation drill', [
        amount('Time to evacuate', 'min'),
        amount('People evacuated', 'people', { mandatory: false }),
        yesNo('Everyone accounted for at the assembly point?'),
        text('What went well and what to improve'),
      ], { category: 'training' }),
    ]),
    template('⛑', 'Weekly Fire Safety Checks', 'Over several days', 'Every week between Monday Before open and Sunday After close', ['Fire Safety'], [
      task('Weekly fire safety checks', [
        yesNo('Fire doors close fully on their own?'),
        yesNo('Escape routes clear inside and outside?'),
        yesNo('Fire blankets in place?'),
        yesNo('Fire action notices displayed?'),
        notes(),
      ]),
    ]),
    template('⛑', 'Monthly Fire Safety Inspection', 'Over several days', 'Every month between the 1st in Before open and the 28th in After close', ['Fire Safety'], [
      task('Monthly fire safety inspection', [
        yesNo('Fire risk assessment reviewed?'),
        yesNo('Extinguishers serviced within the last year?'),
        yesNo('Fire alarm serviced within the last 6 months?'),
        yesNo('New staff given fire training?'),
        notes(),
      ]),
    ]),
    template('🤝', 'Daily Handover Records', 'Over several days', 'Every week between Monday Before open and Sunday After close', ['Brand Standards'], [
      task('Hand over to the next shift', [
        text('What the next shift needs to know'),
        yesNo('Any open issues passed on?'),
        yesNo('Stock or prep short for the next shift?', { mandatory: false }),
      ], { category: 'admin' }),
    ]),

    /* Multiple schedules --------------------------------------------------- */
    template('🚽', 'Hourly Toilet Checks', 'Multiple schedules', '2 repeat schedules', [], [
      task('Check the toilets', [
        cleanCondition('toilets'),
        yesNo('Soap, paper towels and toilet roll stocked?'),
        yesNo('Everything flushing and working?'),
        notes(),
      ]),
    ]),
    template('🌡️', 'Fridge & Freezer Temperature Records', 'Multiple schedules', '2 repeat schedules', ['Food Safety', 'Kitchen'], [
      task('Morning fridge and freezer temperatures', [
        fridgeReading('Walk-in fridge'),
        fridgeReading('Under-counter fridge'),
        freezerReading('Freezer'),
        notes(),
      ]),
      task('Evening fridge and freezer temperatures', [
        fridgeReading('Walk-in fridge'),
        fridgeReading('Under-counter fridge'),
        freezerReading('Freezer'),
        notes(),
      ]),
    ]),

    /* Ad hoc --------------------------------------------------------------- */
    template('🚨', 'False Alarm Records', 'Ad hoc', undefined, ['Fire Safety'], [
      task('Record a false alarm', [
        text('Where it was set off'),
        choice('Cause', ['Cooking fumes', 'Steam', 'Accidental call point', 'Fault', 'Unknown']),
        yesNo('Fire service called?'),
        yesNo('Alarm reset with no faults?'),
      ]),
    ]),
    template('🤕', 'Accident & Incident Record', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Record an accident or incident', [
        text('Who was involved'),
        choice('Type', ['Cut', 'Burn', 'Slip or trip', 'Fall', 'Manual handling', 'Other']),
        text('What happened'),
        yesNo('First aid given?'),
        yesNo('Reportable under RIDDOR?', { hint: 'Answer Yes if it needs reporting to the HSE.' }),
        text('Action taken to stop it happening again'),
      ], { priority: 'high' }),
    ]),
    template('👽', 'Visitor Form', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Sign a visitor in', [
        text('Visitor name'),
        text('Company'),
        text('Reason for visit'),
        yesNo('Given the health and safety briefing?'),
      ], { category: 'admin' }),
    ]),
    template('🐜', 'Pest Activity Form', 'Ad hoc', undefined, ['Food Safety', 'Health and Safety'], [
      task('Report pest activity', [
        choice('Pest seen', ['Mice', 'Rats', 'Cockroaches', 'Flies', 'Birds', 'Other']),
        text('Where'),
        yesNo('Any food contaminated?', { hint: 'Throw away anything that might be.' }),
        yesNo('Pest control contractor called?'),
        notes(),
      ], { priority: 'high' }),
    ]),
    template('🤧', 'Return to Work Form', 'Ad hoc', undefined, [], [
      task('Return to work interview', [
        text('Team member'),
        text('Reason for absence'),
        yesNo('Free of diarrhoea and vomiting for 48 hours?', { hint: 'Food handlers must be clear for 48 hours.' }),
        yesNo('Fit to return to their normal duties?'),
        notes(),
      ], { category: 'admin' }),
    ]),
    template('🧷', 'Foreign Object Form', 'Ad hoc', undefined, ['Food Safety'], [
      task('Record a foreign object', [
        text('Dish'),
        choice('Object found', ['Hair', 'Plastic', 'Metal', 'Glass', 'Packaging', 'Other']),
        yesNo('Guest harmed?'),
        text('Likely source and action taken'),
      ], { priority: 'high' }),
    ]),
    template('🍤', 'Allergic Reaction Form', 'Ad hoc', undefined, ['Food Safety'], [
      task('Record an allergic reaction', [
        text('Guest name and contact'),
        text('What they ate'),
        text('Allergy declared when ordering'),
        yesNo('Emergency services called?'),
        text('What happened and what was done'),
      ], { priority: 'high' }),
    ]),
    template('🤒', 'Food Poisoning Form', 'Ad hoc', undefined, ['Food Safety'], [
      task('Record a food poisoning complaint', [
        text('Guest name and contact'),
        text('Date and time of the visit'),
        text('What they ate'),
        text('Symptoms and when they started'),
        yesNo('Environmental health informed?'),
      ], { priority: 'high' }),
    ]),
    template('🧪', 'COSHH Risk Assessment', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Assess a chemical', [
        text('Product'),
        yesNo('Safety data sheet on file?'),
        yesNo('Chemical sign on door and locked if not in use?'),
        choice('Protective equipment needed', ['None', 'Gloves', 'Gloves and goggles', 'Full PPE']),
        choice('Risk', [{ label: 'Low', score: 2 }, { label: 'Medium', score: 1 }, { label: 'High', exception: true, action: 'require' }], { scored: true }),
      ]),
    ]),
    template('🔉', 'Customer Complaint Form', 'Ad hoc', undefined, ['Brand Standards'], [
      task('Record a complaint', [
        text('Guest name and contact', { mandatory: false }),
        choice('About', ['Food', 'Drink', 'Service', 'Cleanliness', 'Price', 'Other']),
        text('What they said'),
        text('How it was resolved'),
      ], { category: 'admin' }),
    ]),
    template('🔎', 'Food Safety Audit', 'Ad hoc', undefined, ['Audit', 'Food Safety'], [
      task('Storage', [
        yesNo('Fridges at 5°C or below?', { scored: true }),
        yesNo('Raw meat stored below ready-to-eat food?', { scored: true }),
        yesNo('Everything labelled and in date?', { scored: true }),
      ]),
      task('Preparation', [
        yesNo('Colour-coded boards and knives used correctly?', { scored: true }),
        yesNo('Probe used and records complete?', { scored: true }),
        yesNo('Allergen controls followed?', { scored: true }),
      ]),
      task('Hygiene', [
        yesNo('Staff in clean uniform with hair tied back?', { scored: true }),
        yesNo('Hand-wash sinks clear and stocked?', { scored: true }),
        yesNo('Cleaning schedule up to date?', { scored: true }),
        notes('Actions from the audit'),
      ]),
    ]),
    template('🔎', 'Brand Standards Audit', 'Ad hoc', undefined, ['Audit', 'Brand Standards'], [
      task('Arrival', [
        yesNo('Greeted within 30 seconds?', { scored: true }),
        yesNo('Entrance clean and welcoming?', { scored: true }),
      ]),
      task('Service', [
        yesNo('Menu explained and specials offered?', { scored: true }),
        yesNo('Food served within the target time?', { scored: true }),
        yesNo('Checked back within two minutes?', { scored: true }),
      ]),
      task('Departure', [
        yesNo('Bill presented promptly?', { scored: true }),
        yesNo('Thanked and invited back?', { scored: true }),
        notes('Actions from the audit'),
      ]),
    ]),
    template('😷', 'COVID-19 Self Isolation Declaration', 'Ad hoc', undefined, ['Notifications', 'COVID-19'], [
      task('Self isolation declaration', [
        text('Team member'),
        text('First day of isolation'),
        text('Expected return date'),
        check('Rota updated'),
      ], { category: 'admin' }),
    ]),
    template('⛑', 'COVID-19 Visitor Form', 'Ad hoc', undefined, ['Notifications', 'COVID-19'], [
      task('Sign a visitor in', [
        text('Visitor name'),
        text('Contact number'),
        yesNo('Free of symptoms?'),
      ], { category: 'admin' }),
    ]),
    template('🔧', 'Maintenance Log', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Log a repair', [
        text('Equipment or area'),
        text('Fault'),
        choice('Urgency', ['Low', 'Medium', { label: 'High', exception: true, action: 'request' }]),
        yesNo('Taken out of use until fixed?', { mandatory: false }),
        text('Contractor called', { mandatory: false }),
      ], { category: 'maintenance' }),
    ]),
    template('🔎', 'Health & Safety Audit', 'Ad hoc', undefined, ['Audit'], [
      task('Premises', [
        yesNo('Floors, stairs and walkways safe?', { scored: true }),
        yesNo('Lighting adequate everywhere?', { scored: true }),
        yesNo('Electrical equipment PAT tested?', { scored: true }),
      ]),
      task('People', [
        yesNo('Risk assessments reviewed this year?', { scored: true }),
        yesNo('Staff trained for the equipment they use?', { scored: true }),
        yesNo('Accident book reviewed?', { scored: true }),
        notes('Actions from the audit'),
      ]),
    ]),
  ]
}
