/**
 * The starter library of task templates, from the Trail build map in Figma.
 *
 * Names, groups, schedules and tags follow the design; the tasks and questions
 * inside each are a sensible starting point a venue is expected to edit. Built
 * on demand with fresh ids for everything below the template, so adding the
 * library twice (say, on two devices) only ever upserts the same templates.
 *
 * Limits follow UK Food Standards Agency guidance (Safer Food, Better Business)
 * and HSE guidance where it applies.
 */
import { createId } from '@/lib/utils'
import { newOption, newQuestion, TEMPLATE_GROUPS, type OptionSpec } from './taskQuestions'
import type {
  MonitoredCategory,
  TaskCategory,
  TaskPriority,
  TaskQuestion,
  TaskTemplate,
  TemplateTask,
} from './types'


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

/** The other way round: Yes is the problem, so it logs an exception and needs a note. */
function flag(label: string, extras: QuestionExtras = {}): TaskQuestion {
  return choice(label, [{ label: 'Yes', exception: true, action: 'require' }, { label: 'No', score: 1 }], extras)
}

/** A plain fact either way, e.g. "Fire service called?". Neither answer is an exception. */
function fact(label: string, extras: QuestionExtras = {}): TaskQuestion {
  return choice(label, ['Yes', 'No'], extras)
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

/* Linked to the team's own data --------------------------------------------- */

/**
 * One reading for each of the team's fridges (or freezers, or hot holding
 * units), each with its own safe range, worked out when a task is created.
 * `fallback` is asked instead while the team has none set up.
 */
function readings(categories: MonitoredCategory[], fallback: TaskQuestion): TaskQuestion {
  return { ...fallback, source: { kind: 'equipment', categories } }
}

const fridgeReadings = () => readings(['fridge', 'display_fridge'], fridgeReading('Fridge'))
const freezerReadings = () =>
  readings(['freezer'], temp('Freezer temperature', undefined, -18, { hint: 'Should be −18°C or colder.' }))
const hotHoldingReadings = () =>
  readings(['hot_holding'], temp('Hot holding unit temperature', 63, undefined, { hint: 'Should be 63°C or hotter.' }))

/** A choice of the team's active staff; typed in while there are none. */
function teamMember(label: string, extras: QuestionExtras = {}): TaskQuestion {
  return { ...text(label, extras), source: { kind: 'staff' } }
}

/** A choice of the team's active suppliers; typed in while there are none. */
function supplier(label = 'Supplier', extras: QuestionExtras = {}): TaskQuestion {
  return { ...text(label, extras), source: { kind: 'suppliers' } }
}
const handWashSink = (where: string) =>
  yesNo(`Hand-wash sink in the ${where} clear, with hot water, soap and paper towels?`)
const ifOutOfRange = (label: string, fix: string) =>
  choice(label, [
    { label: 'Not applicable' },
    { label: fix, action: 'request' },
    { label: 'Thrown away', exception: true, action: 'require' },
  ])

const ALLERGENS = ['Celery', 'Cereals with gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin', 'Milk', 'Molluscs', 'Mustard', 'Nuts', 'Peanuts', 'Sesame', 'Soya', 'Sulphites']

/* The library --------------------------------------------------------------- */

export function createTemplateLibrary(): TaskTemplate[] {
  return [
    /* Before open ---------------------------------------------------------- */
    template('🔎', 'Manager Opening Checks', 'Before open', 'Every day in Before open', [], [
      task('Walk the site before opening', [
        yesNo('Alarm disarmed and all doors secure on arrival?'),
        flag('Any signs of a break-in, damage or leaks?', { hint: 'Answer No if everything is as it was left.' }),
        yesNo('Lights, heating and ventilation working?'),
        yesNo('CCTV recording?', { mandatory: false }),
        yesNo('No smell of gas, and the gas supply on?'),
        yesNo('Fire exits clear and unlocked?'),
        notes(),
      ]),
      task('Check the kitchen is ready', [
        yesNo('Last night’s closing checks completed?'),
        yesNo('Fridge and freezer temperatures checked and recorded?'),
        yesNo('Probe thermometer clean and working?'),
        yesNo('Someone assigned to check in today’s deliveries?'),
        notes(),
      ]),
      task('Check today’s team and bookings', [
        yesNo('Everyone on the rota has arrived or been accounted for?'),
        flag('Has anyone on shift had diarrhoea or vomiting in the last 48 hours?', { hint: 'Food handlers must stay off work until 48 hours clear.' }),
        yesNo('Everyone in clean uniform?'),
        amount('Covers booked for today', 'covers', { mandatory: false }),
        yesNo('Allergen and special requests passed to the kitchen?'),
        yesNo('Team briefed on specials, items off and allergens?'),
      ], { category: 'admin' }),
      task('Get front of house ready', [
        yesNo('Float in the till and card machines working?'),
        yesNo('Toilets clean and stocked?'),
        yesNo('Entrance and windows clean?'),
        yesNo('Menus correct, with allergen information available?'),
        notes(),
      ], { category: 'prep' }),
    ]),
    template('🌡', 'Cellar Temperature Records', 'Before open', 'Every day in Before open', [], [
      task('Record the cellar temperature', [
        temp('Cellar temperature', 11, 13, { hint: 'Keep cask ale between 11°C and 13°C.' }),
        yesNo('Cellar cooling unit running normally?'),
        yesNo('Cellar thermometer working?'),
        notes(),
      ]),
      task('Check the cellar condition', [
        yesNo('Cellar floor clean and dry?'),
        yesNo('Drains and gullies clear?'),
        yesNo('Gas cylinders chained upright?'),
        flag('Any leaks from kegs, couplers or lines?'),
        yesNo('Cellar door closed and secure?'),
        notes(),
      ]),
      task('Check stock and rotation', [
        yesNo('Oldest stock at the front, ready to go on next?'),
        yesNo('All casks and kegs within their best-before dates?'),
        yesNo('Casks stillaged and settled before serving?'),
        yesNo('Spare gas cylinders available?'),
        notes('Stock to order'),
      ], { category: 'admin' }),
    ]),
    template('☕️', 'Coffee Brew Records', 'Before open', 'Every day in Before open', [], [
      task('Dial in the espresso', [
        amount('Dose', 'g', { min: 16, max: 22 }),
        amount('Yield', 'g', { min: 32, max: 48 }),
        amount('Extraction time', 's', { min: 25, max: 32 }),
        text('Grinder setting', { mandatory: false }),
        choice('Taste', [{ label: 'Balanced' }, { label: 'Sour', action: 'request' }, { label: 'Bitter', action: 'request' }]),
        notes('Grind or recipe changes made'),
      ], { category: 'prep' }),
      task('Check the machine', [
        amount('Boiler pressure', 'bar', { min: 0.9, max: 1.5, mandatory: false }),
        check('Group heads flushed'),
        yesNo('Steam wands purged and clean?'),
        yesNo('Drip trays empty and clean?'),
        yesNo('Water filter in date?'),
      ], { category: 'maintenance' }),
      task('Check milk and supplies', [
        temp('Milk fridge temperature', -1, 5),
        yesNo('Milk in date and rotated?'),
        yesNo('Plant milks stored and labelled apart, with their own jugs?', { hint: 'Avoids milk getting into a dairy-free order.' }),
        yesNo('Cups, lids and syrups stocked for service?'),
      ], { category: 'prep' }),
    ]),
    template('😷', 'COVID-19 Team Health Records', 'Before open', 'Every day in Before open', ['COVID-19'], [
      task('Team health check', [
        yesNo('Has everyone on shift confirmed they are free of symptoms?'),
        flag('Anyone told to stay at home today?', { mandatory: false }),
        text('Names of anyone sent home', { mandatory: false }),
        yesNo('Team reminded to report symptoms straight away?'),
      ]),
      task('Check hygiene stations', [
        yesNo('Hand sanitiser stocked at the entrance and in staff areas?'),
        yesNo('Hand-wash sinks stocked with soap and paper towels?'),
        yesNo('Touch points cleaned: door handles, card machines and menus?'),
        yesNo('Ventilation on, or windows open where possible?'),
        notes(),
      ]),
    ]),

    /* Open ----------------------------------------------------------------- */
    template('🍔', 'Opening Checks - Food Safety', 'Open', 'Every day in Open', ['Food Safety'], [
      task('Check temperatures', [
        fridgeReadings(),
        freezerReadings(),
        yesNo('Probe thermometer clean, probe wipes available and working?'),
      ]),
      task('Check food storage', [
        yesNo('All food in date, labelled and covered?'),
        yesNo('Raw food stored below and away from ready-to-eat food?'),
        yesNo('Allergen ingredients sealed and labelled?'),
        yesNo('Stock rotated: first in, first out?'),
        yesNo('Dry store clean, with nothing stored on the floor?'),
      ]),
      task('Check hygiene', [
        handWashSink('kitchen'),
        yesNo('Sanitiser made up at the right dilution?'),
        yesNo('Staff in clean uniform, hair tied back, no jewellery?'),
        yesNo('All cuts covered with blue plasters?'),
        yesNo('No signs of pests: droppings, gnaw marks or insects?'),
      ]),
      task('Check yesterday’s records', [
        yesNo('Yesterday’s food safety records complete and signed?'),
        yesNo('Allergen matrix matches today’s menu?'),
        notes(),
      ], { category: 'admin' }),
    ]),
    template('🍸', 'Opening Checks - Bar', 'Open', 'Every day in Open', [], [
      task('Set up the bar', [
        yesNo('Ice machine clean and ice scoop stored outside the ice?'),
        yesNo('Glass washer filled, chemicals connected and at temperature?'),
        temp('Bottle fridge temperature', 1, 8, { mandatory: false }),
        yesNo('Garnishes prepped, covered and dated?'),
        yesNo('Float in the till and card machines working?'),
        notes(),
      ], { category: 'prep' }),
      task('Check the drinks', [
        yesNo('Spirits, wine and mixers stocked for service?'),
        yesNo('Draught pumps pulled through and pouring clear?'),
        yesNo('Cask ales tasted and clear?'),
        yesNo('Spirit measures and optics clean and stamped?'),
      ], { category: 'prep' }),
      task('Check bar safety and licensing', [
        yesNo('Premises licence summary on display?'),
        yesNo('Challenge 25 signs displayed and refusals log to hand?'),
        yesNo('Bar floor dry, with mats down?'),
        yesNo('Glass bin, dustpan and brush ready for breakages?'),
        notes(),
      ]),
    ]),
    template('⛑', 'Opening Checks - Health and Safety', 'Open', 'Every day in Open', [], [
      task('Health and safety walk-round', [
        yesNo('Fire exits and escape routes clear?'),
        yesNo('Floors dry and free of trip hazards?'),
        yesNo('Wet floor signs available?'),
        yesNo('Electrical equipment and leads free of visible damage?'),
        notes(),
      ]),
      task('Check fire safety', [
        yesNo('Fire alarm panel showing no faults?'),
        yesNo('Fire extinguishers and blankets in place?'),
        yesNo('Fire doors closed, not wedged open?'),
      ]),
      task('Check kitchen safety', [
        yesNo('Knives stored safely?'),
        yesNo('Guards fitted to slicers, mixers and other machines?'),
        yesNo('Chemicals labelled and stored away from food?'),
        yesNo('Oven gloves and other protective equipment available?'),
      ]),
      task('Check first aid and people', [
        yesNo('First aid box stocked?'),
        yesNo('A trained first aider on shift?'),
        yesNo('Accident book in place?'),
        yesNo('Anyone new has had their safety induction?'),
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
      task('Record opening temperatures', [
        fridgeReadings(),
        freezerReadings(),
        notes(),
      ]),
      task('Check the equipment', [
        yesNo('Ovens, grills and hobs heating up correctly?'),
        yesNo('Fryer oil clean and at the right level?'),
        yesNo('Dishwasher filled and at temperature?'),
        yesNo('Probe thermometer calibrated this week?'),
      ], { category: 'maintenance' }),
      task('Plan the prep', [
        yesNo('Prep list written for today?'),
        yesNo('Today’s specials checked for allergens?'),
        yesNo('Space cleared for today’s deliveries?'),
        notes(),
      ], { category: 'prep' }),
    ]),
    template('🚰', 'Sink & Hot Water Records', 'Open', 'Every day in Open', ['Health and Safety', 'Kitchen', 'Toilets'], [
      task('Kitchen sinks', [
        temp('Hot water temperature at the kitchen hand-wash sink', 50, undefined),
        handWashSink('kitchen'),
        yesNo('Hand-wash sink used only for hand washing?', { hint: 'No food, equipment or washing-up in it.' }),
        yesNo('Taps and drains working?'),
      ]),
      task('Bar sinks', [
        temp('Hot water temperature at the bar hand-wash sink', 50, undefined),
        handWashSink('bar'),
      ]),
      task('Toilet sinks', [
        temp('Hot water temperature in the toilets', 50, undefined),
        yesNo('Soap and paper towels stocked?'),
        yesNo('Taps and drains working?'),
        notes(),
      ]),
      task('Hot water system', [
        temp('Hot water leaving the boiler or cylinder', 60, undefined, { mandatory: false, hint: 'Stored hot water should be 60°C or hotter to control Legionella.' }),
        yesNo('Boiler showing no fault codes?'),
      ], { category: 'maintenance' }),
    ]),
    template('🪑', 'Opening Checks - Indoor Area', 'Open', 'Every day in Open', [], [
      task('Indoor area ready for guests', [
        cleanCondition('dining area'),
        yesNo('Tables laid and menus clean?'),
        yesNo('Flowers, candles and table decor fresh?'),
        yesNo('Lighting and music set?'),
        yesNo('Room at a comfortable temperature?'),
        notes(),
      ], { category: 'prep' }),
      task('Entrance and welcome', [
        yesNo('Entrance clean, with mats down?'),
        yesNo('Today’s bookings printed or on screen?'),
        yesNo('High chairs and booster seats clean?'),
        yesNo('Allergen notice on display?'),
      ], { category: 'prep' }),
      task('Indoor safety', [
        yesNo('Walkways between tables clear?'),
        yesNo('Furniture stable, with no wobbly tables or broken chairs?'),
        yesNo('Exit signs lit?'),
        yesNo('Toilets checked and stocked?'),
        notes(),
      ]),
    ]),
    template('🌳', 'Opening Checks - Outdoor Area', 'Open', 'Every day in Open', [], [
      task('Outdoor area ready for guests', [
        cleanCondition('outdoor area'),
        yesNo('Furniture safe, stable and wiped down?'),
        yesNo('Heaters and umbrellas working?', { mandatory: false }),
        yesNo('Smoking area bins emptied?'),
        notes(),
      ], { category: 'prep' }),
      task('Outdoor safety', [
        yesNo('Paths and steps clear of trip hazards, ice and leaves?'),
        yesNo('Outdoor lighting working?'),
        yesNo('Gas heater cylinders secure and stored safely?', { mandatory: false }),
        yesNo('Umbrellas and gazebos secured against wind?', { mandatory: false }),
      ]),
      task('Signs and boundaries', [
        yesNo('Smoking area clearly signed?'),
        yesNo('Edge of the licensed area clear to guests?'),
        yesNo('Gates and fences secure?'),
        notes(),
      ]),
    ]),

    /* Morning -------------------------------------------------------------- */
    template('🚨', 'Weekly Fire Alarm Test Records', 'Morning', 'Every week on Monday in After close', ['Fire Safety'], [
      task('Get ready for the test', [
        yesNo('Team and any guests told a test is about to happen?'),
        yesNo('Alarm monitoring company told, if the alarm is monitored?', { mandatory: false }),
      ]),
      task('Test the fire alarm', [
        text('Call point tested', { hint: 'Use a different call point each week.' }),
        yesNo('Alarm sounded throughout the building?'),
        yesNo('Heard in the toilets, cellar and outside areas?'),
        yesNo('Flashing beacons worked?', { mandatory: false }),
        yesNo('Magnetic door holders released?', { mandatory: false }),
        yesNo('Alarm panel reset with no faults showing?'),
        notes(),
      ]),
      task('Record the test', [
        yesNo('Logged in the fire safety logbook?'),
        text('Faults found', { mandatory: false }),
      ], { category: 'admin' }),
    ]),
    template('🚰', 'Legionella Test Records', 'Morning', 'Every day between Morning and After close', ['Health and Safety'], [
      task('Flush little-used outlets', [
        text('Outlets flushed', { hint: 'e.g. staff shower, spare toilet tap.' }),
        yesNo('Each run for at least 2 minutes?'),
        yesNo('Water ran clear, with no discolouration or smell?'),
      ]),
      task('Check the sentinel outlets', [
        temp('Hot water at the sentinel outlet', 50, undefined, { hint: 'Should reach 50°C within a minute.' }),
        temp('Cold water at the sentinel outlet', undefined, 20, { hint: 'Should be below 20°C within two minutes.' }),
      ]),
      task('Check the system', [
        yesNo('Shower heads clean and free of scale?', { mandatory: false }),
        yesNo('Cold water tank lid secure?', { mandatory: false }),
        flag('Any new unused pipework or taps since the last check?', { mandatory: false, hint: 'Dead legs let water stand. Tell the water hygiene contractor.' }),
        notes(),
      ], { category: 'maintenance' }),
    ]),

    /* Evening -------------------------------------------------------------- */
    template('📝', 'Weekly Manager Report', 'Evening', 'Every week on Friday in After close', [], [
      task('Write up the week', [
        text('Wins this week'),
        text('Problems and what’s being done about them'),
        text('Priorities for next week'),
      ], { category: 'admin' }),
      task('Record the numbers', [
        amount('Sales this week', '£', { mandatory: false }),
        amount('Covers this week', 'covers', { mandatory: false }),
        amount('Labour hours this week', 'h', { mandatory: false }),
        amount('Food cost', '%', { mandatory: false }),
        amount('Wastage this week', '£', { mandatory: false }),
      ], { category: 'admin' }),
      task('Team update', [
        yesNo('Next week’s rota published?'),
        text('Training completed this week', { mandatory: false }),
        flag('Any absences or staff issues to follow up?', { mandatory: false }),
      ], { category: 'admin' }),
      task('Compliance review', [
        yesNo('All compliance records complete for the week?'),
        yesNo('Every accident recorded and followed up?'),
        yesNo('Every complaint responded to?'),
        text('Maintenance jobs still open', { mandatory: false }),
      ]),
    ]),

    /* Close ---------------------------------------------------------------- */
    template('🌙', 'Closing Checks - Kitchen Manager', 'Close', 'Every day between Close and After close', ['Kitchen'], [
      task('Put food away', [
        yesNo('All food covered, labelled and stored?'),
        yesNo('Leftovers cooled quickly, labelled and in the fridge?'),
        yesNo('Food past its use-by or shelf life thrown away?'),
        yesNo('Hot holding emptied and switched off?'),
      ]),
      task('Record closing temperatures', [
        fridgeReadings(),
        freezerReadings(),
      ]),
      task('Clean down', [
        yesNo('Surfaces and equipment cleaned and sanitised?'),
        yesNo('Grill, ovens and fryers cleaned?'),
        yesNo('Floors swept and mopped?'),
        yesNo('Drains and grease traps clear?'),
        yesNo('Bins emptied and lids closed?'),
        cleanCondition('kitchen'),
      ]),
      task('Shut down the kitchen', [
        yesNo('Gas, fryers and extraction switched off?'),
        yesNo('Everything except fridges and freezers switched off?'),
        yesNo('Back door locked?'),
        notes(),
      ]),
    ]),
    template('🌳', 'Closing Checks - Outdoor Area', 'Close', 'Every day between Close and After close', [], [
      task('Clear the outdoor area', [
        yesNo('Glasses, crockery and litter collected?'),
        yesNo('Tables wiped down?'),
        yesNo('Ashtrays emptied into a metal bin, with nothing still lit?'),
        yesNo('Floor swept?'),
      ]),
      task('Secure the outdoor area', [
        yesNo('Furniture stacked or secured?'),
        yesNo('Cushions and umbrellas brought in?', { mandatory: false }),
        yesNo('Heaters switched off and gas cylinders turned off?', { mandatory: false }),
        yesNo('Lights switched off?'),
        yesNo('Gates locked?'),
        notes(),
      ]),
    ]),
    template('👋', 'Closing Checks - FOH', 'Close', 'Every day between Close and After close', ['Brand Standards'], [
      task('Close down front of house', [
        yesNo('Tables cleared, wiped and reset?'),
        yesNo('Menus wiped and stacked?'),
        yesNo('Condiments refilled and cutlery polished?'),
        notes(),
      ]),
      task('Close down the bar', [
        yesNo('Glass washer drained and cleaned?'),
        yesNo('Drip trays and nozzles cleaned?'),
        yesNo('Garnishes covered and in the fridge?'),
        yesNo('Bar fridges stocked for tomorrow, doors closed?'),
      ]),
      task('Cash up', [
        yesNo('Tills cashed up and floats bagged?'),
        yesNo('Takings match the till report?'),
        notes('Explain any difference'),
      ], { category: 'admin' }),
    ]),
    template('🪑', 'Closing Checks - Indoor Area', 'Close', 'Every day between Close and After close', [], [
      task('Clean the indoor area', [
        cleanCondition('dining area'),
        yesNo('Floors vacuumed or mopped?'),
        yesNo('Toilets checked and cleaned?'),
        yesNo('Bins emptied?'),
      ]),
      task('Secure the indoor area', [
        yesNo('Nobody left in the toilets or back areas?'),
        yesNo('Candles out?'),
        yesNo('Windows and doors locked?'),
        yesNo('Lights and music off?'),
        notes(),
      ]),
    ]),

    /* After close ---------------------------------------------------------- */
    template('🗑', 'Wastage Records', 'After close', 'Every day in After close', ['Food Safety'], [
      task('Record today’s food wastage', [
        text('Items thrown away', { hint: 'One per line, with quantities.' }),
        choice('Main reason', ['Out of date', 'Over-prepped', 'Damaged', 'Returned by guest', 'Temperature failure', 'Dropped or spilled']),
        amount('Weight thrown away', 'kg', { mandatory: false }),
        amount('Estimated cost', '£', { mandatory: false }),
      ], { category: 'admin' }),
      task('Record today’s drinks wastage', [
        text('Drinks wasted', { mandatory: false }),
        choice('Main reason', ['None today', 'Spillage', 'Line cleaning', 'Returned by guest', 'Breakage', 'Out of date'], { mandatory: false }),
        amount('Estimated cost', '£', { mandatory: false }),
      ], { category: 'admin' }),
      task('Deal with the waste', [
        yesNo('Waste bagged, bins closed and bin store tidy?'),
        yesNo('Used cooking oil stored for collection?', { mandatory: false }),
        text('What would cut tomorrow’s waste?', { mandatory: false }),
      ]),
    ]),
    template('🔎', 'Manager Closing Checks', 'After close', 'Every day in After close', ['Manager only', 'Brand Standards'], [
      task('Cash up', [
        amount('Takings', '£', { mandatory: false }),
        yesNo('Takings match the till report?'),
        yesNo('Cash banked or locked in the safe?'),
        yesNo('Safe locked and keys secured?'),
        notes('Explain any difference'),
      ], { category: 'admin', priority: 'high' }),
      task('Check the building', [
        yesNo('All staff signed out and off the premises?'),
        yesNo('Toilets and back areas checked, nobody left inside?'),
        yesNo('Gas and cooking equipment off?'),
        yesNo('Fridges and freezers running and closed?'),
      ]),
      task('Lock up', [
        yesNo('All doors and windows locked?'),
        yesNo('Alarm set?'),
        notes(),
      ], { priority: 'high' }),
      task('Review the day', [
        yesNo('All of today’s checks completed?'),
        yesNo('Any accidents or complaints recorded?'),
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
      task('Clean the espresso machine', [
        check('Group heads back-flushed with detergent'),
        check('Portafilters and baskets soaked'),
        check('Steam wands soaked and wiped'),
        check('Drip trays and grates washed'),
        yesNo('Machine switched off or in eco mode?'),
      ], { category: 'maintenance' }),
    ]),

    /* All day -------------------------------------------------------------- */
    template('💰', 'Float Count Records', 'All day', 'Every day between Before open and After close', [], [
      task('Count the float', [
        amount('Float counted', '£'),
        amount('Expected float', '£'),
        yesNo('Float matches what’s expected?'),
        yesNo('Counted with a second person?', { mandatory: false }),
        notes('Explain any difference'),
      ], { category: 'admin' }),
      task('Check the till during service', [
        yesNo('Enough change for the shift?'),
        yesNo('Till drawer locked when unattended?'),
        yesNo('Large notes moved to the safe?', { mandatory: false }),
      ], { category: 'admin' }),
    ]),
    template('🌡', 'Reheating Temperature Records', 'All day', 'Every day between Before open and After close', ['Reheated Food'], [
      task('Probe reheated food', [
        text('Food reheated'),
        temp('Core temperature', 75, undefined, { hint: 'Reheat until steaming hot: 75°C or above (82°C in Scotland).' }),
        ifOutOfRange('If below 75°C', 'Reheated further'),
        yesNo('Reheated only once?'),
        yesNo('Served or hot held straight away?'),
      ]),
      task('Clean the probe', [
        yesNo('Probe cleaned with a probe wipe between foods?'),
      ]),
    ]),
    template('🍽', 'Dishwasher Checks', 'All day', 'Every day between Before open and After close', [], [
      task('Check the dishwasher', [
        temp('Wash temperature', 55, 65),
        temp('Rinse temperature', 82, undefined),
        yesNo('Detergent and rinse aid levels OK?'),
        yesNo('Filters clean?'),
        yesNo('Wash and rinse arms spin freely, with the jets clear?'),
      ], { category: 'maintenance' }),
      task('Check the results', [
        yesNo('Crockery and glasses coming out clean and dry?'),
        yesNo('Chipped or cracked crockery taken out of use?'),
        flag('Limescale on the elements, arms or inside?', { mandatory: false }),
        notes(),
      ]),
    ]),
    template('🌡️', 'Hot Holding Temperature Records', 'All day', 'Every day between Before open and After close', ['Cooked Food'], [
      task('Probe hot-held food', [
        text('Food being held'),
        text('Time it went into hot holding', { mandatory: false }),
        temp('Core temperature', 63, undefined, { hint: 'Hold at 63°C or above.' }),
        ifOutOfRange('If below 63°C', 'Reheated to 75°C'),
        yesNo('Bain-marie or hot cupboard at temperature?'),
        yesNo('Food covered and stirred regularly?'),
      ]),
      task('Check the hot holding units', [
        hotHoldingReadings(),
        yesNo('Units clean, with water topped up in any bain-marie?'),
      ]),
      task('Check after 2 hours', [
        temp('Core temperature after 2 hours', 63, undefined, { mandatory: false }),
        choice('What happened to it', ['Still being held', 'Sold out', 'Thrown away after 2 hours below 63°C', 'Cooled for later']),
      ]),
    ]),
    template('🚛', 'Delivery Records', 'All day', 'Every day between Before open and After close', ['Food Safety'], [
      task('Check a delivery in', [
        supplier(),
        text('Delivery note or invoice number', { mandatory: false }),
        yesNo('Delivery vehicle clean and refrigerated where needed?'),
        temp('Chilled goods temperature', undefined, 8, { mandatory: false, hint: 'Reject chilled food above 8°C.' }),
        temp('Frozen goods temperature', undefined, -15, { mandatory: false, hint: 'Reject frozen food warmer than −15°C.' }),
      ]),
      task('Check the goods', [
        yesNo('Packaging undamaged and sealed?'),
        yesNo('Use-by dates long enough to use in time?'),
        yesNo('Everything ordered was delivered?'),
        notes('Rejected items and why'),
      ]),
      task('Put the delivery away', [
        yesNo('Chilled and frozen food put away within 15 minutes?'),
        yesNo('Stock rotated, with new stock behind the old?'),
      ], { category: 'prep' }),
    ]),
    template('⛑', 'Weekly First Aid Box Checks', 'All day', 'Every week on Friday in After close', ['Health and Safety'], [
      task('Check the first aid box', [
        yesNo('Plasters, including blue catering plasters, stocked?'),
        yesNo('Dressings and bandages stocked?'),
        yesNo('Burn gel or burns dressings stocked?'),
        yesNo('Gloves and eye wash stocked?'),
        yesNo('Everything in date?'),
        notes('Items to reorder'),
      ]),
      task('Check first aid arrangements', [
        yesNo('First aider names on display?'),
        yesNo('Accident book in place?'),
        yesNo('Completed accident pages stored securely?', { hint: 'They hold personal details.' }),
        yesNo('Last week’s accidents followed up?'),
      ]),
    ]),
    template('⛑', 'Monthly Fire Extinguisher Records', 'All day', 'Every month on the 22nd between Before open and After close', ['Fire Safety'], [
      task('Inspect the fire extinguishers', [
        yesNo('All extinguishers in place and unobstructed?'),
        yesNo('Right type for the area?', { hint: 'CO₂ by electrics, wet chemical by fryers.' }),
        yesNo('Pressure gauges in the green?'),
        yesNo('Pins and tamper seals intact?'),
        yesNo('Hoses and horns undamaged?'),
        yesNo('Service labels in date?'),
        text('Extinguishers needing service', { mandatory: false }),
      ]),
      task('Check fire blankets and signs', [
        yesNo('Fire blankets in place with pull tapes intact?'),
        yesNo('A sign above each extinguisher?'),
        notes(),
      ]),
    ]),
    template('🥜', 'Allergen Control Records', 'All day', 'Every day between Before open and After close', ['Food Safety'], [
      task('Allergen order check', [
        text('Table or order'),
        choice('Allergen', ALLERGENS),
        yesNo('Allergy written on the order?'),
        yesNo('Chef told in person, not just on the ticket?'),
        yesNo('Dish checked against the allergen matrix, sauces and garnishes too?'),
        yesNo('Prepared with clean equipment, away from the allergen?'),
        yesNo('Delivered to the table by the person who checked it?'),
      ], { priority: 'high' }),
      task('Allergen controls for the shift', [
        yesNo('Allergen matrix matches today’s menu and specials?'),
        yesNo('Any recipe or supplier changes checked for allergens?'),
        yesNo('Allergen-safe boards and utensils available?'),
        yesNo('Team briefed on today’s allergens?'),
      ]),
    ]),
    template('🎛', 'Sous Vide Control Records', 'All day', 'Every day between Before open and After close', [], [
      task('Record a sous vide batch', [
        text('Product'),
        yesNo('Bag sealed with no leaks?'),
        temp('Water bath temperature', undefined, undefined),
        yesNo('Bath checked with a calibrated probe?'),
        amount('Time in the bath', 'min'),
        yesNo('Time and temperature follow the pasteurisation table for this thickness?'),
        temp('Core temperature at the end', 55, undefined),
      ], { category: 'prep' }),
      task('Chill and store the batch', [
        choice('After cooking', ['Served straight away', 'Chilled in iced water', 'Held hot']),
        temp('Temperature once chilled', undefined, 5, { mandatory: false, hint: 'Chill to 5°C or below within 90 minutes.' }),
        yesNo('Labelled with the date and use-by?'),
      ], { category: 'prep' }),
    ]),
    template('🌡️', 'Defrosting Records', 'All day', 'Every day between Before open and After close', ['Defrosted Food'], [
      task('Log defrosting food', [
        text('Product'),
        text('Date and time it came out of the freezer', { mandatory: false }),
        choice('Defrosted in', ['Fridge', 'Cold running water', 'Microwave']),
        yesNo('Covered on a tray on the bottom shelf?'),
      ]),
      task('Check it once defrosted', [
        yesNo('Fully defrosted, with no ice crystals left?'),
        temp('Temperature once defrosted', undefined, 5),
        yesNo('Labelled with a use-by date?'),
        yesNo('Not refrozen?'),
      ]),
    ]),
    template('🍺', 'Line Cleaning Records', 'All day', 'Every week on Monday in After close', [], [
      task('Prepare to clean', [
        yesNo('Gloves and goggles on?'),
        yesNo('Pumps labelled “Line cleaning in progress”?'),
        yesNo('Cleaning solution diluted as the label says?'),
      ], { category: 'maintenance' }),
      task('Clean the beer lines', [
        text('Lines cleaned'),
        amount('Time the solution was left in', 'min', { min: 20 }),
        yesNo('Nozzles and couplers soaked and cleaned?'),
        yesNo('Lines flushed until the water ran clear?'),
        yesNo('First pint tasted and clear?'),
        amount('Beer pulled through to waste', 'pints', { mandatory: false }),
      ], { category: 'maintenance' }),
    ]),
    template('🍸', 'Pour Test', 'All day', 'Every day between Before open and After close', [], [
      task('Test a bartender’s pour', [
        teamMember('Bartender'),
        choice('Measure tested', ['25 ml', '35 ml', '50 ml']),
        amount('Measured spirit pour', 'ml', { hint: 'Within 2 ml of the measure.' }),
        yesNo('Using a stamped jigger or optic?'),
        amount('Measured wine pour', 'ml', { mandatory: false, hint: '125, 175 or 250 ml.' }),
      ], { category: 'training' }),
      task('Give feedback', [
        yesNo('Result shared with the bartender?'),
        text('Coaching given', { mandatory: false }),
      ], { category: 'training' }),
    ]),
    template('🧽', 'Weekly Deep Clean', 'All day', 'Every week on Tuesday in After close', [], [
      task('Deep clean the kitchen', [
        check('Behind and under equipment'),
        check('Extraction canopy and filters'),
        check('Walls and tiles'),
        check('Walk-in fridge shelves and seals'),
        check('Drains and grease traps'),
        cleanCondition('kitchen once finished'),
      ], { category: 'maintenance' }),
      task('Deep clean front of house', [
        check('Skirting boards and corners'),
        check('Under seating and banquettes'),
        check('Light fittings'),
        check('Bar back shelves and fridges'),
        cleanCondition('dining area once finished'),
      ], { category: 'maintenance' }),
      task('Deep clean back of house', [
        check('Toilet tiles and grout'),
        check('Staff room and lockers'),
        check('Bin store'),
        check('Cellar floor'),
        notes(),
      ], { category: 'maintenance' }),
    ]),
    template('🌡', 'Cooling Temperature Records', 'All day', 'Every day between Before open and After close', ['Cooked Food'], [
      task('Log cooling food', [
        text('Food cooling'),
        text('Time cooking finished', { mandatory: false }),
        choice('Cooled in', ['Shallow trays', 'Ice bath', 'Blast chiller', 'Split into smaller portions']),
      ]),
      task('Check it after 90 minutes', [
        temp('Temperature after 90 minutes', undefined, 8, { hint: 'Cool to 8°C or below within 90 minutes.' }),
        ifOutOfRange('If above 8°C', 'Moved to the blast chiller'),
        yesNo('Covered, labelled and in the fridge?'),
        yesNo('Labelled with the date cooked and use-by?'),
      ]),
    ]),

    /* Over several days ---------------------------------------------------- */
    template('⛑', 'Monthly Emergency Lighting Test', 'Over several days', 'Every month between the 1st in Before open and the 7th in After close', ['Fire Safety'], [
      task('Test the emergency lighting', [
        yesNo('All emergency lights came on when tested?'),
        yesNo('Exit signs lit during the test?'),
        yesNo('All lights back to normal after the test?'),
        yesNo('Fittings clean and undamaged?'),
        text('Faulty fittings', { mandatory: false }),
      ]),
      task('Record the test', [
        yesNo('Logged in the fire safety logbook?'),
        yesNo('Full 3-hour test done in the last 12 months?', { hint: 'Usually by an electrician.' }),
      ], { category: 'admin' }),
    ]),
    template('🌡', 'Weekly Probe Calibration', 'Over several days', 'Every week between Monday Before open and Sunday After close', ['Cooked Food', 'Reheated Food'], [
      task('Calibrate each probe', [
        text('Probe'),
        temp('Reading in iced water', -1, 1),
        temp('Reading in boiling water', 99, 101),
        yesNo('Probe within ±1°C both times?'),
        choice('If not', [{ label: 'Not applicable' }, { label: 'Recalibrated', action: 'request' }, { label: 'Replaced', exception: true, action: 'require' }]),
      ], { category: 'maintenance' }),
      task('Check probe condition', [
        yesNo('Battery OK?'),
        yesNo('Probe tip and cable undamaged?'),
        yesNo('Probe wipes stocked?'),
      ], { category: 'maintenance' }),
    ]),
    template('⛑', 'Monthly Fire Evacuation Drill', 'Over several days', 'Every 3 months between the 1st in Before open and the 28th in After close', ['Fire Safety'], [
      task('Run an evacuation drill', [
        yesNo('Alarm heard everywhere, including toilets and outside areas?'),
        yesNo('Fire wardens checked every area?'),
        yesNo('Guests guided out calmly?', { mandatory: false }),
        yesNo('Nobody went back for belongings or used a lift?'),
        yesNo('Evacuation plans for anyone needing help followed?', { mandatory: false }),
        amount('Time to evacuate', 'min'),
        amount('People evacuated', 'people', { mandatory: false }),
        yesNo('Everyone accounted for at the assembly point?'),
      ], { category: 'training' }),
      task('Review the drill', [
        text('Who took part'),
        text('What went well and what to improve'),
        yesNo('Logged in the fire safety logbook?'),
      ], { category: 'training' }),
    ]),
    template('⛑', 'Weekly Fire Safety Checks', 'Over several days', 'Every week between Monday Before open and Sunday After close', ['Fire Safety'], [
      task('Weekly fire safety checks', [
        yesNo('Fire doors close fully on their own?'),
        yesNo('Escape routes clear inside and outside?'),
        yesNo('Fire extinguishers and blankets in place?'),
        yesNo('Fire action notices displayed?'),
        yesNo('Fire alarm tested this week?'),
        notes(),
      ]),
      task('Check fire risks', [
        yesNo('Rubbish and cardboard stored away from exits and heat?'),
        yesNo('Kitchen extraction filters cleaned this week?'),
        yesNo('Emergency lights and exit signs undamaged?'),
        flag('Any overloaded sockets or daisy-chained extension leads?'),
        notes(),
      ]),
    ]),
    template('⛑', 'Monthly Fire Safety Inspection', 'Over several days', 'Every month between the 1st in Before open and the 28th in After close', ['Fire Safety'], [
      task('Monthly fire safety inspection', [
        yesNo('Fire risk assessment reviewed?'),
        yesNo('Fire safety logbook up to date?'),
        yesNo('Emergency lighting tested this month?'),
        yesNo('Fire drill held in the last 6 months?'),
        notes(),
      ]),
      task('Check servicing', [
        yesNo('Extinguishers serviced within the last year?'),
        yesNo('Fire alarm serviced within the last 6 months?'),
        yesNo('Kitchen extract ducts cleaned within the last year?'),
      ], { category: 'maintenance' }),
      task('Check training', [
        yesNo('New staff given fire training?'),
        yesNo('A fire warden named for every shift?'),
        notes(),
      ], { category: 'training' }),
    ]),
    template('🤝', 'Daily Handover Records', 'Over several days', 'Every week between Monday Before open and Sunday After close', ['Brand Standards'], [
      task('Hand over to the next shift', [
        text('What the next shift needs to know'),
        yesNo('Any open issues passed on?'),
        flag('Stock or prep short for the next shift?', { mandatory: false }),
        flag('Any equipment faults?', { mandatory: false }),
        text('Bookings, VIPs or guest feedback to know about', { mandatory: false }),
      ], { category: 'admin' }),
      task('Check your shift is complete', [
        yesNo('Temperature checks done for your shift?'),
        yesNo('Till and float handed over?'),
        yesNo('Work areas left clean?'),
      ]),
    ]),

    /* Multiple schedules --------------------------------------------------- */
    template('🚽', 'Hourly Toilet Checks', 'Multiple schedules', '2 repeat schedules', [], [
      task('Check the toilets', [
        cleanCondition('toilets'),
        yesNo('Floor dry and clean?'),
        yesNo('Soap, paper towels and toilet roll stocked?'),
        yesNo('Everything flushing and working?'),
        yesNo('Hand dryers working?', { mandatory: false }),
        yesNo('Bins and sanitary bins not overflowing?'),
        yesNo('Baby change clean?', { mandatory: false }),
        notes(),
      ]),
    ]),
    template('🌡️', 'Fridge & Freezer Temperature Records', 'Multiple schedules', '2 repeat schedules', ['Food Safety', 'Kitchen'], [
      task('Morning fridge and freezer temperatures', [
        fridgeReadings(),
        freezerReadings(),
        notes(),
      ]),
      task('Evening fridge and freezer temperatures', [
        fridgeReadings(),
        freezerReadings(),
        notes(),
      ]),
      task('Check fridge condition', [
        yesNo('Door seals intact and doors closing properly?'),
        yesNo('Not overloaded, with air able to flow?'),
        yesNo('Raw food stored below ready-to-eat food?'),
        yesNo('Freezers free of ice build-up?'),
      ]),
    ]),

    /* Ad hoc --------------------------------------------------------------- */
    template('🚨', 'False Alarm Records', 'Ad hoc', undefined, ['Fire Safety'], [
      task('Record a false alarm', [
        text('Date and time'),
        text('Where it was set off'),
        choice('Cause', ['Cooking fumes', 'Steam', 'Accidental call point', 'Fault', 'Unknown']),
        fact('Building evacuated?'),
        fact('Fire service called?'),
        yesNo('Alarm reset with no faults?'),
      ]),
      task('Follow up', [
        yesNo('Alarm company told?', { mandatory: false }),
        yesNo('Logged in the fire safety logbook?'),
        text('What’s been done to stop it happening again'),
      ]),
    ]),
    template('🤕', 'Accident & Incident Record', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Record an accident or incident', [
        text('Date, time and where it happened'),
        text('Who was involved'),
        choice('They are', ['Team member', 'Guest', 'Contractor', 'Visitor']),
        choice('Type', ['Cut', 'Burn', 'Slip or trip', 'Fall', 'Manual handling', 'Other']),
        text('What happened'),
        text('Witnesses', { mandatory: false }),
      ], { priority: 'high' }),
      task('Treatment and reporting', [
        fact('First aid given?'),
        choice('Outcome', ['Carried on', 'Went home', 'Went to hospital', 'Ambulance called']),
        yesNo('Accident book completed?'),
        fact('Reportable under RIDDOR?', { hint: 'Yes if it needs reporting to the HSE, e.g. a major injury or 7+ days off work.' }),
      ], { priority: 'high' }),
      task('Prevent it happening again', [
        yesNo('Area made safe?'),
        text('Action taken to stop it happening again'),
        yesNo('Risk assessment reviewed?', { mandatory: false }),
      ]),
    ]),
    template('👽', 'Visitor Form', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Sign a visitor in', [
        text('Visitor name'),
        text('Company'),
        text('Reason for visit'),
        text('Time in'),
        yesNo('Given the health and safety briefing?'),
        yesNo('Shown the fire exits and assembly point?'),
      ], { category: 'admin' }),
      task('Before going into food areas', [
        flag('Has the visitor had diarrhoea or vomiting in the last 48 hours?', { mandatory: false, hint: 'If Yes, they mustn’t enter food areas.' }),
        yesNo('Wearing a clean coat or apron and hair covered?', { mandatory: false }),
        yesNo('Contractor’s risk assessment or permit checked?', { mandatory: false }),
      ]),
      task('Sign the visitor out', [
        text('Time out', { mandatory: false }),
        yesNo('Work area left safe and clean?', { mandatory: false }),
      ], { category: 'admin' }),
    ]),
    template('🐜', 'Pest Activity Form', 'Ad hoc', undefined, ['Food Safety', 'Health and Safety'], [
      task('Report pest activity', [
        choice('Pest seen', ['Mice', 'Rats', 'Cockroaches', 'Flies', 'Birds', 'Other']),
        choice('What was found', ['Live pest', 'Dead pest', 'Droppings', 'Gnaw marks', 'Nest']),
        text('Where'),
        flag('Any food contaminated?', { hint: 'Throw away anything that might be.' }),
        fact('Area closed off?'),
      ], { priority: 'high' }),
      task('Deal with it', [
        yesNo('Area cleaned and disinfected?'),
        yesNo('Pest control contractor called?'),
        yesNo('Entry points found and blocked?', { mandatory: false }),
        yesNo('Contractor’s report filed?', { mandatory: false }),
        notes(),
      ], { priority: 'high' }),
    ]),
    template('🤧', 'Return to Work Form', 'Ad hoc', undefined, [], [
      task('Return to work interview', [
        teamMember('Team member'),
        text('Dates off'),
        choice('Reason', ['Stomach upset', 'Cold or flu', 'Injury', 'Other illness', 'Personal']),
        yesNo('Free of diarrhoea and vomiting for 48 hours?', { hint: 'Food handlers must be clear for 48 hours.' }),
        flag('Anyone at home with diarrhoea or vomiting?', { mandatory: false }),
        yesNo('Fit to return to their normal duties?'),
      ], { category: 'admin' }),
      task('Follow up', [
        fact('Fit note needed?', { hint: 'Needed after 7 days off.' }),
        fact('Any changes to their duties agreed?'),
        yesNo('Absence recorded on the rota and payroll?'),
        notes(),
      ], { category: 'admin' }),
    ]),
    template('🧷', 'Foreign Object Form', 'Ad hoc', undefined, ['Food Safety'], [
      task('Record a foreign object', [
        text('Dish'),
        choice('Object found', ['Hair', 'Plastic', 'Metal', 'Glass', 'Packaging', 'Other']),
        flag('Guest harmed?'),
        yesNo('Object kept, bagged and labelled?'),
      ], { priority: 'high' }),
      task('Investigate', [
        yesNo('Rest of the batch checked?'),
        text('Likely source and action taken'),
        yesNo('Supplier told, if it came in their product?', { mandatory: false }),
        yesNo('Complaint recorded and guest contacted?'),
      ], { priority: 'high' }),
    ]),
    template('🍤', 'Allergic Reaction Form', 'Ad hoc', undefined, ['Food Safety'], [
      task('Record an allergic reaction', [
        text('Date and time'),
        text('Guest name and contact'),
        text('What they ate'),
        text('Allergy declared when ordering'),
        fact('Emergency services called?'),
        text('What happened and what was done'),
      ], { priority: 'high' }),
      task('Investigate', [
        yesNo('Dish or leftovers kept?', { mandatory: false }),
        yesNo('Spoken to whoever took the order, cooked and served it?'),
        yesNo('Recipe and ingredient labels checked?'),
        yesNo('Environmental health told?', { mandatory: false }),
        text('What’s changing so it doesn’t happen again'),
      ], { priority: 'high' }),
    ]),
    template('🤒', 'Food Poisoning Form', 'Ad hoc', undefined, ['Food Safety'], [
      task('Record a food poisoning complaint', [
        text('Guest name and contact'),
        text('Date and time of the visit'),
        text('What they ate'),
        text('Symptoms and when they started'),
        amount('People ill', 'people', { mandatory: false }),
        fact('Seen a doctor?', { mandatory: false }),
      ], { priority: 'high' }),
      task('Investigate', [
        yesNo('That day’s temperature, delivery and cleaning records checked?'),
        yesNo('Staff sickness that day checked?'),
        yesNo('Any of the same food kept?', { mandatory: false }),
        yesNo('Environmental health informed?'),
        notes('Findings'),
      ], { priority: 'high' }),
    ]),
    template('🧪', 'COSHH Risk Assessment', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Assess a chemical', [
        text('Product'),
        text('What it’s used for'),
        choice('Main hazard', ['Corrosive', 'Irritant', 'Toxic', 'Flammable', 'Harmful to the environment']),
        yesNo('Safety data sheet on file?'),
        choice('Protective equipment needed', ['None', 'Gloves', 'Gloves and goggles', 'Full PPE']),
        choice('Risk', [{ label: 'Low', score: 2 }, { label: 'Medium', score: 1 }, { label: 'High', exception: true, action: 'require' }], { scored: true }),
      ]),
      task('Check how it’s used and stored', [
        yesNo('Stored in its original, labelled container?'),
        yesNo('Chemical sign on door and locked if not in use?'),
        yesNo('Diluted with the dosing system or as the label says?'),
        yesNo('Staff who use it have been trained?'),
        yesNo('First aid steps known if it’s splashed or swallowed?'),
        notes('Safer alternatives considered'),
      ]),
    ]),
    template('🔉', 'Customer Complaint Form', 'Ad hoc', undefined, ['Brand Standards'], [
      task('Record a complaint', [
        text('Guest name and contact', { mandatory: false }),
        text('Date and table', { mandatory: false }),
        choice('About', ['Food', 'Drink', 'Service', 'Cleanliness', 'Price', 'Other']),
        text('What they said'),
        yesNo('A manager spoke to the guest?'),
      ], { category: 'admin' }),
      task('Resolve it', [
        choice('What was offered', ['Apology', 'Dish replaced', 'Taken off the bill', 'Voucher', 'Refund']),
        text('How it was resolved'),
        fact('Follow-up needed?'),
        yesNo('Shared with the team?'),
      ], { category: 'admin' }),
    ]),
    template('🔎', 'Food Safety Audit', 'Ad hoc', undefined, ['Audit', 'Food Safety'], [
      task('Storage', [
        yesNo('Fridges at 5°C or below?', { scored: true }),
        yesNo('Freezers at −18°C or below?', { scored: true }),
        yesNo('Raw meat stored below ready-to-eat food?', { scored: true }),
        yesNo('Everything labelled and in date?', { scored: true }),
        yesNo('Dry store clean and off the floor?', { scored: true }),
      ]),
      task('Preparation and cooking', [
        yesNo('Colour-coded boards and knives used correctly?', { scored: true }),
        yesNo('Food cooked to 75°C, or a safe time and temperature?', { scored: true }),
        yesNo('Hot holding at 63°C or above?', { scored: true }),
        yesNo('Cooling within 90 minutes?', { scored: true }),
        yesNo('Allergen controls followed?', { scored: true }),
      ]),
      task('Hygiene and cleaning', [
        yesNo('Staff in clean uniform with hair tied back?', { scored: true }),
        yesNo('Hand-wash sinks clear and stocked?', { scored: true }),
        yesNo('Cleaning schedule up to date?', { scored: true }),
        yesNo('Sanitiser at the right dilution and contact time?', { scored: true }),
        yesNo('No signs of pests?', { scored: true }),
      ]),
      task('Records', [
        yesNo('Temperature records complete for the last week?', { scored: true }),
        yesNo('Probe calibrated in the last week?', { scored: true }),
        yesNo('Delivery records complete?', { scored: true }),
        yesNo('Staff food safety training up to date?', { scored: true }),
        notes('Actions from the audit'),
      ], { category: 'admin' }),
    ]),
    template('🔎', 'Brand Standards Audit', 'Ad hoc', undefined, ['Audit', 'Brand Standards'], [
      task('Arrival', [
        yesNo('Greeted within 30 seconds?', { scored: true }),
        yesNo('Entrance clean and welcoming?', { scored: true }),
        yesNo('Seated promptly, or wait time explained?', { scored: true }),
      ]),
      task('Service', [
        yesNo('Drinks order taken within 3 minutes?', { scored: true }),
        yesNo('Menu explained and specials offered?', { scored: true }),
        yesNo('Allergies asked about?', { scored: true }),
        yesNo('Food served within the target time?', { scored: true }),
        yesNo('Checked back within two minutes?', { scored: true }),
      ]),
      task('Food and drink', [
        yesNo('Food presented to spec?', { scored: true }),
        yesNo('Food served at the right temperature?', { scored: true }),
        yesNo('Drinks served in clean, correct glassware?', { scored: true }),
      ]),
      task('Cleanliness', [
        yesNo('Tables, chairs and floors clean?', { scored: true }),
        yesNo('Toilets clean and stocked?', { scored: true }),
        yesNo('Team in clean, correct uniform?', { scored: true }),
      ]),
      task('Departure', [
        yesNo('Bill presented promptly?', { scored: true }),
        yesNo('Thanked and invited back?', { scored: true }),
        notes('Actions from the audit'),
      ]),
    ]),
    template('😷', 'COVID-19 Self Isolation Declaration', 'Ad hoc', undefined, ['Notifications', 'COVID-19'], [
      task('Self isolation declaration', [
        teamMember('Team member'),
        text('First day of isolation'),
        text('Expected return date'),
        yesNo('Manager told?'),
        text('Colleagues they worked closely with', { mandatory: false }),
      ], { category: 'admin' }),
      task('Cover and return', [
        check('Rota updated'),
        check('Return to work check booked'),
      ], { category: 'admin' }),
    ]),
    template('⛑', 'COVID-19 Visitor Form', 'Ad hoc', undefined, ['Notifications', 'COVID-19'], [
      task('Sign a visitor in', [
        text('Visitor name'),
        text('Contact number'),
        text('Time in'),
        text('Areas visited', { mandatory: false }),
        yesNo('Free of symptoms?'),
        yesNo('Hand sanitiser used on arrival?'),
      ], { category: 'admin' }),
    ]),
    template('🔧', 'Maintenance Log', 'Ad hoc', undefined, ['Health and Safety'], [
      task('Log a repair', [
        text('Equipment or area'),
        text('Fault'),
        teamMember('Reported by', { mandatory: false }),
        choice('Urgency', ['Low', 'Medium', { label: 'High', exception: true, action: 'request' }]),
        yesNo('Area made safe?'),
        yesNo('Taken out of use until fixed?', { mandatory: false }),
        text('Contractor called', { mandatory: false }),
      ], { category: 'maintenance' }),
      task('Sign off the repair', [
        text('Date fixed', { mandatory: false }),
        yesNo('Checked and working after the repair?'),
        amount('Cost', '£', { mandatory: false }),
        yesNo('Contractor’s paperwork filed?', { mandatory: false }),
      ], { category: 'maintenance' }),
    ]),
    template('🔎', 'Health & Safety Audit', 'Ad hoc', undefined, ['Audit'], [
      task('Premises', [
        yesNo('Floors, stairs and walkways safe?', { scored: true }),
        yesNo('Lighting adequate everywhere?', { scored: true }),
        yesNo('Electrical equipment PAT tested?', { scored: true }),
        yesNo('Gas safety certificate in date?', { scored: true }),
      ]),
      task('Fire safety', [
        yesNo('Fire risk assessment reviewed this year?', { scored: true }),
        yesNo('Escape routes and fire doors clear?', { scored: true }),
        yesNo('Weekly alarm tests recorded?', { scored: true }),
        yesNo('Extinguishers serviced in the last year?', { scored: true }),
      ]),
      task('Kitchen and equipment', [
        yesNo('Machine guards fitted and used?', { scored: true }),
        yesNo('Chemicals stored safely, with COSHH assessments?', { scored: true }),
        yesNo('Gas interlock and extraction working?', { scored: true }),
      ]),
      task('People and welfare', [
        yesNo('Risk assessments reviewed this year?', { scored: true }),
        yesNo('Staff trained for the equipment they use?', { scored: true }),
        yesNo('First aid box stocked and first aiders named?', { scored: true }),
        yesNo('Accident book reviewed?', { scored: true }),
        yesNo('Health and safety law poster displayed?', { scored: true }),
        notes('Actions from the audit'),
      ]),
    ]),
  ]
}
