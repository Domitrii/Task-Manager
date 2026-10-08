import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, Copy, Ellipsis, Link2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useStore } from '@/data/store'
import {
  ANSWER_PRESETS,
  describeSource,
  matchingPreset,
  newOption,
  newQuestion,
  presetAnswers,
  presetQuestion,
} from '@/data/taskQuestions'
import type { OptionAction, QuestionOption, QuestionSource, QuestionType, TaskQuestion } from '@/data/types'
import { questionSummary, questionTypeLabel } from '@/lib/taskAnswers'
import { cn } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Select, TextInput, Toggle } from '@/components/ui/Field'
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu'
import { copyQuestion, move, questionAnchor } from './editing'

const TYPES: QuestionType[] = ['options', 'text', 'number', 'check']

const ACTIONS: { value: OptionAction; label: string }[] = [
  { value: 'none', label: 'No action' },
  { value: 'request', label: 'Request action' },
  { value: 'require', label: 'Require action' },
]

/**
 * Every question of a task, each one collapsible so a long task stays easy to
 * scan. Controlled: changes go straight back through `onChange`.
 */
export function QuestionListEditor({
  questions,
  onChange,
  expanded,
  onExpandedChange,
}: {
  questions: TaskQuestion[]
  onChange: (questions: TaskQuestion[]) => void
  /** Ids of the open questions. Lifted so an outline can open the one it jumps to. */
  expanded: Set<string>
  onExpandedChange: (expanded: Set<string>) => void
}) {
  const allOpen = questions.length > 0 && questions.every((question) => expanded.has(question.id))

  function setOpen(id: string, open: boolean) {
    const next = new Set(expanded)
    if (open) next.add(id)
    else next.delete(id)
    onExpandedChange(next)
  }

  function replace(index: number, question: TaskQuestion) {
    onChange(questions.map((entry, position) => (position === index ? question : entry)))
  }

  function add(type: QuestionType, preset?: string) {
    const question = preset ? presetQuestion(preset) : newQuestion(type)
    onChange([...questions, question])
    onExpandedChange(new Set(expanded).add(question.id))
    // After the new card renders.
    requestAnimationFrame(() => document.getElementById(questionAnchor(question.id))?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  function duplicate(index: number) {
    const copy = copyQuestion(questions[index])
    onChange([...questions.slice(0, index + 1), copy, ...questions.slice(index + 1)])
    onExpandedChange(new Set(expanded).add(copy.id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-muted text-[13px]">
          {questions.length === 0
            ? 'No questions yet. Without any, the task is just ticked off.'
            : `${questions.length} question${questions.length === 1 ? '' : 's'}`}
        </p>
        {questions.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onExpandedChange(allOpen ? new Set() : new Set(questions.map((question) => question.id)))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        ) : null}
      </div>

      <ol className="space-y-3">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            number={index + 1}
            open={expanded.has(question.id)}
            onToggle={() => setOpen(question.id, !expanded.has(question.id))}
            onChange={(next) => replace(index, next)}
            onMove={(delta) => onChange(move(questions, index, delta))}
            canMoveUp={index > 0}
            canMoveDown={index < questions.length - 1}
            onDuplicate={() => duplicate(index)}
            onDelete={() => onChange(questions.filter((entry) => entry.id !== question.id))}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => add('options')}>
          <Plus className="size-4" />
          Add question
        </Button>
        <Menu
          align="left"
          trigger={({ toggle }) => (
            <Button variant="ghost" onClick={toggle}>
              Other types
              <ChevronDown className="size-4" />
            </Button>
          )}
        >
          {({ close }) => (
            <>
              {ANSWER_PRESETS.filter((preset) => preset.key !== 'yes-no').map((preset) => (
                <MenuItem
                  key={preset.key}
                  onClick={() => {
                    add('options', preset.key)
                    close()
                  }}
                >
                  {preset.label}
                </MenuItem>
              ))}
              <MenuDivider />
              {TYPES.filter((type) => type !== 'options').map((type) => (
                <MenuItem
                  key={type}
                  onClick={() => {
                    add(type)
                    close()
                  }}
                >
                  {questionTypeLabel(type)}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>
    </div>
  )
}

function QuestionCard({
  question,
  number,
  open,
  onToggle,
  onChange,
  onMove,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onDelete,
}: {
  question: TaskQuestion
  number: number
  open: boolean
  onToggle: () => void
  onChange: (question: TaskQuestion) => void
  onMove: (delta: number) => void
  canMoveUp: boolean
  canMoveDown: boolean
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { data } = useStore()
  const set = (changes: Partial<TaskQuestion>) => onChange({ ...question, ...changes })

  function changeType(type: QuestionType) {
    // Switching to multiple choice with nothing to choose from starts at Yes / No.
    const options = type === 'options' && question.options.length === 0 ? newQuestion('options').options : question.options
    set({ type, options })
  }

  return (
    <li
      id={questionAnchor(question.id)}
      className="bg-surface border-line rounded-card scroll-mt-24 border shadow-card"
    >
      <div className="flex items-start gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 py-1 text-left"
        >
          <span className="bg-surface-muted text-ink-muted mt-px flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums">
            {number}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block text-sm font-medium', question.label ? 'text-ink' : 'text-ink-subtle italic')}>
              {question.label || 'Untitled question'}
            </span>
            {!open ? (
              <span className="text-ink-muted mt-0.5 flex items-center gap-1 truncate text-xs">
                {question.source ? <Link2 className="text-brand-600 dark:text-brand-300 size-3.5 shrink-0" /> : null}
                <span className="truncate">
                  {question.source ? describeSource(question.source, data) : questionSummary(question)}
                </span>
              </span>
            ) : null}
          </span>
          <ChevronDown className={cn('text-ink-subtle mt-0.5 size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        <Menu
          trigger={({ toggle }) => (
            <IconButton label={`Question ${number} actions`} size="sm" onClick={toggle}>
              <Ellipsis className="size-4" />
            </IconButton>
          )}
        >
          {({ close }) => (
            <>
              {canMoveUp ? (
                <MenuItem icon={<ArrowUp className="size-4" />} onClick={() => { onMove(-1); close() }}>
                  Move up
                </MenuItem>
              ) : null}
              {canMoveDown ? (
                <MenuItem icon={<ArrowDown className="size-4" />} onClick={() => { onMove(1); close() }}>
                  Move down
                </MenuItem>
              ) : null}
              <MenuItem icon={<Copy className="size-4" />} onClick={() => { onDuplicate(); close() }}>
                Duplicate
              </MenuItem>
              <MenuDivider />
              <MenuItem tone="danger" icon={<Trash2 className="size-4" />} onClick={() => { onDelete(); close() }}>
                Delete question
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      {open ? (
        <div className="border-line space-y-4 border-t px-3 py-4 sm:px-4">
          {question.source ? (
            <SourceNotice source={question.source} onUnlink={() => set({ source: undefined })} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Question" htmlFor={`${question.id}-label`}>
              <TextInput
                id={`${question.id}-label`}
                value={question.label}
                placeholder="e.g. Is the probe clean and working?"
                onChange={(event) => set({ label: event.target.value })}
              />
            </Field>
            <Field label="Answer type" htmlFor={`${question.id}-type`}>
              <Select
                id={`${question.id}-type`}
                value={question.type}
                onChange={(event) => changeType(event.target.value as QuestionType)}
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {questionTypeLabel(type)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Guidance" hint="Optional. Shown under the question while answering." htmlFor={`${question.id}-hint`}>
            <TextInput
              id={`${question.id}-hint`}
              value={question.hint ?? ''}
              onChange={(event) => set({ hint: event.target.value || undefined })}
            />
          </Field>

          <SettingRow
            label="Mandatory"
            description="Has to be answered before the task can be completed."
            checked={question.mandatory}
            onChange={(mandatory) => set({ mandatory })}
          />

          {question.type === 'options' ? <OptionsSettings question={question} onChange={onChange} /> : null}
          {question.type === 'number' ? <NumberSettings question={question} onChange={onChange} /> : null}
        </div>
      ) : null}
    </li>
  )
}

const SOURCE_SETTINGS: Record<QuestionSource['kind'], { tab: string; label: string }> = {
  equipment: { tab: 'equipment', label: 'Settings → Equipment' },
  staff: { tab: 'staff', label: 'Settings → Team' },
  suppliers: { tab: 'suppliers', label: 'Settings → Suppliers' },
}

/** What a linked question is filled from when a task is created, and a way to make it an ordinary question. */
function SourceNotice({ source, onUnlink }: { source: QuestionSource; onUnlink: () => void }) {
  const { data } = useStore()
  const settings = SOURCE_SETTINGS[source.kind]
  return (
    <div className="bg-brand-50 border-brand-600/20 dark:bg-brand-500/10 flex items-start gap-3 rounded-lg border p-3">
      <Link2 className="text-brand-600 dark:text-brand-300 mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-ink text-[13px] font-medium">Filled from your team’s data</p>
        <p className="text-ink-muted text-[13px]">
          {describeSource(source, data)} Each new task uses what’s in{' '}
          <Link to={`/settings?tab=${settings.tab}`} className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
            {settings.label}
          </Link>{' '}
          at the time.
          {source.kind === 'equipment' ? ' The settings below are only used while none is set up.' : ''}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onUnlink}>
        Unlink
      </Button>
    </div>
  )
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-ink text-sm font-medium">{label}</p>
        <p className="text-ink-muted text-xs">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function OptionsSettings({ question, onChange }: { question: TaskQuestion; onChange: (question: TaskQuestion) => void }) {
  const setOptions = (options: QuestionOption[]) => onChange({ ...question, options })
  const setOption = (index: number, changes: Partial<QuestionOption>) =>
    setOptions(question.options.map((option, position) => (position === index ? { ...option, ...changes } : option)))

  return (
    <div className="space-y-4">
      <SettingRow
        label="Scores"
        description="Give each option a score, added up into a score for the task."
        checked={question.scored}
        onChange={(scored) => onChange({ ...question, scored })}
      />

      <div>
        <p className="text-ink mb-2 text-sm font-medium">Answer with</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Answer with">
          {ANSWER_PRESETS.map((preset) => {
            const chosen = matchingPreset(question) === preset.key
            return (
              <button
                key={preset.key}
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => onChange({ ...question, ...presetAnswers(preset.key) })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                  chosen
                    ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-500/12 dark:text-brand-200'
                    : 'border-line-default text-ink hover:border-line-strong',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <p className="text-ink-muted mt-1.5 text-xs">Replaces the options below. You can still change each one after.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink text-sm font-medium">Display options as</p>
        <div className="bg-surface-muted flex rounded-lg p-0.5" role="radiogroup" aria-label="Display options as">
          {(['buttons', 'dropdown'] as const).map((display) => (
            <button
              key={display}
              type="button"
              role="radio"
              aria-checked={question.display === display}
              onClick={() => onChange({ ...question, display })}
              className={cn(
                'h-8 rounded-md px-3 text-[13px] font-medium capitalize transition-colors',
                question.display === display ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
              )}
            >
              {display}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-ink mb-2 text-sm font-medium">Options</p>
        <ul className="space-y-2">
          {question.options.map((option, index) => (
            <li key={option.id} className="bg-surface-muted/60 border-line rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <TextInput
                  aria-label={`Option ${index + 1}`}
                  value={option.label}
                  placeholder={`Option ${index + 1}`}
                  onChange={(event) => setOption(index, { label: event.target.value })}
                  className="min-w-0 flex-1"
                />
                {question.scored ? (
                  <TextInput
                    aria-label={`Score for option ${index + 1}`}
                    type="number"
                    inputMode="numeric"
                    value={String(option.score)}
                    onChange={(event) => setOption(index, { score: Number(event.target.value) || 0 })}
                    className="w-20"
                  />
                ) : null}
                <IconButton
                  label="Move option up"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => setOptions(move(question.options, index, -1))}
                >
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton
                  label="Move option down"
                  size="sm"
                  disabled={index === question.options.length - 1}
                  onClick={() => setOptions(move(question.options, index, 1))}
                >
                  <ArrowDown className="size-4" />
                </IconButton>
                <IconButton
                  label="Delete option"
                  size="sm"
                  onClick={() => setOptions(question.options.filter((entry) => entry.id !== option.id))}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-0.5">
                <Checkbox
                  label="Log exception"
                  checked={option.exception}
                  onChange={(event) => setOption(index, { exception: event.target.checked })}
                />
                <Select
                  aria-label={`Action for option ${index + 1}`}
                  value={option.action}
                  onChange={(event) => setOption(index, { action: event.target.value as OptionAction })}
                  className="h-8 w-auto min-w-40 text-[13px]"
                >
                  {ACTIONS.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ul>
        {question.options.length === 0 ? (
          <p className="text-warn-700 dark:text-warn-500 mt-2 flex items-center gap-1.5 text-xs">
            <TriangleAlert className="size-3.5" />
            Add at least one option, or there’ll be nothing to choose.
          </p>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() => setOptions([...question.options, newOption({ label: '' })])}
        >
          <Plus className="size-4" />
          Add option
        </Button>
      </div>
    </div>
  )
}

function NumberSettings({ question, onChange }: { question: TaskQuestion; onChange: (question: TaskQuestion) => void }) {
  const toNumber = (value: string) => (value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value))
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Unit" htmlFor={`${question.id}-unit`}>
          <TextInput
            id={`${question.id}-unit`}
            value={question.unit ?? ''}
            placeholder="°C"
            onChange={(event) => onChange({ ...question, unit: event.target.value || undefined })}
          />
        </Field>
        <Field label="Lowest" htmlFor={`${question.id}-min`}>
          <NumberInput
            id={`${question.id}-min`}
            value={question.min}
            onChange={(value) => onChange({ ...question, min: toNumber(value) })}
          />
        </Field>
        <Field label="Highest" htmlFor={`${question.id}-max`}>
          <NumberInput
            id={`${question.id}-max`}
            value={question.max}
            onChange={(value) => onChange({ ...question, max: toNumber(value) })}
          />
        </Field>
      </div>
      <p className="text-ink-muted text-xs">
        Answers outside this range are logged as exceptions and need a note on what was done. Leave a limit empty for
        none.
      </p>
    </div>
  )
}

/**
 * Keeps what's typed, so a half-typed "-" or "1." survives until it's a
 * number, while the question only ever stores numbers.
 */
function NumberInput({ id, value, onChange }: { id: string; value: number | undefined; onChange: (value: string) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  return (
    <TextInput
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      placeholder="None"
      onChange={(event) => {
        setText(event.target.value)
        onChange(event.target.value)
      }}
    />
  )
}
