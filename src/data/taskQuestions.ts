/** Building blocks for task questions, shared by the template library and the editors. */
import { createId } from '@/lib/utils'
import type {
  AppData,
  MonitoredCategory,
  MonitoredItem,
  OptionAction,
  QuestionOption,
  QuestionSource,
  TaskQuestion,
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

export interface OptionSpec {
  label: string
  score?: number
  exception?: boolean
  action?: OptionAction
}

export function newOption(spec: OptionSpec): QuestionOption {
  return {
    id: createId('qo'),
    label: spec.label,
    score: spec.score ?? 0,
    exception: spec.exception ?? false,
    action: spec.action ?? 'none',
  }
}

export function newQuestion(type: TaskQuestion['type'], label = ''): TaskQuestion {
  return {
    id: createId('qq'),
    label,
    type,
    mandatory: true,
    options:
      type === 'options'
        ? [
            newOption({ label: 'Yes', score: 1 }),
            newOption({ label: 'No', exception: true, action: 'require' }),
          ]
        : [],
    display: 'buttons',
    scored: false,
  }
}

/** Ready-made answer sets for a multiple choice question. */
export const ANSWER_PRESETS: { key: string; label: string; scored: boolean; options: OptionSpec[] }[] = [
  {
    key: 'yes-no',
    label: 'Yes / No',
    scored: false,
    options: [{ label: 'Yes', score: 1 }, { label: 'No', exception: true, action: 'require' }],
  },
  {
    key: 'yes-no-na',
    label: 'Yes / No / N/A',
    scored: false,
    options: [{ label: 'Yes', score: 1 }, { label: 'No', exception: true, action: 'require' }, { label: 'N/A' }],
  },
  {
    key: 'pass-fail',
    label: 'Pass / Fail',
    scored: false,
    options: [{ label: 'Pass', score: 1 }, { label: 'Fail', exception: true, action: 'require' }],
  },
  {
    key: 'good-ok-poor',
    label: 'Good / OK / Poor',
    scored: true,
    options: [
      { label: 'Good', score: 2 },
      { label: 'OK', score: 1, action: 'request' },
      { label: 'Poor', exception: true, action: 'require' },
    ],
  },
  {
    key: 'scale',
    label: 'Scale 1–5',
    scored: true,
    options: [
      { label: '1', score: 1, exception: true, action: 'request' },
      { label: '2', score: 2, action: 'request' },
      { label: '3', score: 3 },
      { label: '4', score: 4 },
      { label: '5', score: 5 },
    ],
  },
]

/** A multiple choice question answered with one of `ANSWER_PRESETS`. */
export function presetQuestion(key: string, label = ''): TaskQuestion {
  return { ...newQuestion('options', label), ...presetAnswers(key) }
}

/** The options and scoring of a preset, with fresh ids. */
export function presetAnswers(key: string): Pick<TaskQuestion, 'options' | 'scored' | 'display'> {
  const preset = ANSWER_PRESETS.find((entry) => entry.key === key) ?? ANSWER_PRESETS[0]
  return { options: preset.options.map(newOption), scored: preset.scored, display: 'buttons' }
}

/** Which preset a question's options match, if any, so the editor can show it as chosen. */
export function matchingPreset(question: TaskQuestion): string | null {
  const labels = question.options.map((option) => option.label).join('|')
  return ANSWER_PRESETS.find((preset) => preset.options.map((option) => option.label).join('|') === labels)?.key ?? null
}

export function newTemplateTask(title = ''): TemplateTask {
  return { id: createId('tt'), title, category: 'compliance', priority: 'normal', questions: [] }
}

/* Questions filled from team data ----------------------------------------- */

const EQUIPMENT_NAMES: Record<MonitoredCategory, string> = {
  fridge: 'fridge',
  freezer: 'freezer',
  display_fridge: 'display fridge',
  hot_holding: 'hot holding unit',
  cooking: 'cooked food',
  cooling: 'cooling batch',
}

type TeamData = Pick<AppData, 'items' | 'staff' | 'suppliers'>

function joinWithAnd(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

function equipmentFor(source: Extract<QuestionSource, { kind: 'equipment' }>, data: TeamData): MonitoredItem[] {
  return data.items.filter((item) => item.active && source.categories.includes(item.category))
}

function namesFor(source: Extract<QuestionSource, { kind: 'staff' | 'suppliers' }>, data: TeamData): string[] {
  const entries = source.kind === 'staff' ? data.staff : data.suppliers
  return entries.filter((entry) => entry.active).map((entry) => entry.name)
}

function safeRange(item: MonitoredItem): string | null {
  if (item.minTemp !== null && item.maxTemp !== null) return `Keep between ${item.minTemp}°C and ${item.maxTemp}°C.`
  if (item.maxTemp !== null) return `Keep at ${item.maxTemp}°C or colder.`
  if (item.minTemp !== null) return `Keep at ${item.minTemp}°C or hotter.`
  return null
}

/**
 * A template's questions as a new task should ask them: linked questions
 * become one reading per piece of the team's equipment, or a choice of its
 * staff or suppliers. With nothing to fill one from, it stays as written,
 * so a new team still gets a usable task.
 */
export function resolveQuestions(questions: TaskQuestion[], data: TeamData): TaskQuestion[] {
  return questions.flatMap((question): TaskQuestion[] => {
    const { source, ...plain } = structuredClone(question)
    if (!source) return [plain]

    if (source.kind === 'equipment') {
      const items = equipmentFor(source, data)
      if (items.length === 0) return [plain]
      return items.map((item) => ({
        ...plain,
        id: createId('qq'),
        label: `${item.name} temperature`,
        hint: [item.location, safeRange(item)].filter(Boolean).join(' · ') || undefined,
        type: 'number',
        unit: '°C',
        min: item.minTemp ?? undefined,
        max: item.maxTemp ?? undefined,
        itemId: item.id,
      }))
    }

    const names = namesFor(source, data)
    if (names.length === 0) return [{ ...plain, type: 'text', options: [] }]
    return [
      {
        ...plain,
        type: 'options',
        options: names.map((label) => newOption({ label })),
        display: names.length > 4 ? 'dropdown' : 'buttons',
        scored: false,
      },
    ]
  })
}

/** What a linked question will ask, given the team's data right now. */
export function describeSource(source: QuestionSource, data: TeamData): string {
  if (source.kind === 'equipment') {
    const kinds = joinWithAnd([...new Set(source.categories.map((category) => EQUIPMENT_NAMES[category]))])
    const items = equipmentFor(source, data)
    if (items.length === 0) return `One reading for each ${kinds}. None set up yet, so it’s asked as written.`
    return `One reading for each ${kinds}, with its own safe range. ${items.length} now: ${joinWithAnd(items.map((item) => item.name))}.`
  }
  const names = namesFor(source, data)
  const what = source.kind === 'staff' ? 'team member' : 'supplier'
  if (names.length === 0) return `A choice of your ${what}s. None set up yet, so it’s asked as a typed answer.`
  return `A choice of your ${what}s. ${names.length} now: ${joinWithAnd(names)}.`
}
