import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Pencil, TriangleAlert } from 'lucide-react'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import type { ID, Task, TaskAnswer, TaskQuestion } from '@/data/types'
import { formatRelativeDay } from '@/lib/format'
import {
  actionFor,
  chosenOption,
  exceptionCount,
  isAnswered,
  isException,
  isOutOfRange,
  problemWith,
  taskScore,
  unfinishedQuestions,
} from '@/lib/taskAnswers'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { templatePath } from '@/features/templates/editing'
import { QuestionListEditor } from '@/features/templates/QuestionEditor'

/**
 * Answering a task's questions. Its questions can be changed here too, for
 * this task only; the template it came from stays as it was.
 */
export function TaskRunModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, updateTask } = useStore()
  const toast = useToast()
  const [questions, setQuestions] = useState<TaskQuestion[]>(task.questions ?? [])
  const [answers, setAnswers] = useState<Record<ID, TaskAnswer>>(task.answers ?? {})
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showProblems, setShowProblems] = useState(false)

  const draft = { questions, answers }
  const unfinished = unfinishedQuestions(draft)
  const exceptions = exceptionCount(draft)
  const score = taskScore(draft)
  const answered = questions.filter((question) => isAnswered(question, answers[question.id])).length
  const done = task.status === 'done'
  const template = task.templateId ? data.taskTemplates.find((entry) => entry.id === task.templateId) : undefined

  function setAnswer(id: ID, answer: TaskAnswer | undefined) {
    setAnswers((current) => {
      const next = { ...current }
      if (answer) next[id] = answer
      else delete next[id]
      return next
    })
  }

  function save(changes: Partial<Task> = {}) {
    // Starting on the questions moves a task along, so the list shows someone is on it.
    const started = task.status === 'todo' && Object.keys(answers).length > 0
    updateTask(task.id, { questions, answers, ...(started ? { status: 'in_progress' } : {}), ...changes })
  }

  function complete() {
    if (unfinished.length > 0) {
      setEditing(false)
      setShowProblems(true)
      requestAnimationFrame(() =>
        document.getElementById(`answer-${unfinished[0].id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      )
      return
    }
    save({ status: 'done', completedAt: new Date().toISOString() })
    toast.success(
      'Task complete',
      exceptions > 0 ? `${exceptions} exception${exceptions === 1 ? '' : 's'} logged.` : 'No exceptions.',
    )
    onClose()
  }

  const meta = [
    task.assigneeId ? staffName(data, task.assigneeId) : 'Unassigned',
    task.dueAt ? `Due ${formatRelativeDay(task.dueAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Modal
      open
      onClose={onClose}
      title={task.title}
      description={meta}
      size="lg"
      footer={
        editing ? (
          <Button variant="primary" onClick={() => setEditing(false)}>
            Done editing
          </Button>
        ) : done ? (
          <>
            <Button variant="ghost" onClick={() => { save({ status: 'todo', completedAt: undefined }); onClose() }}>
              Reopen task
            </Button>
            <Button variant="primary" onClick={() => { save(); onClose() }}>
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { save(); onClose() }}>
              Save for later
            </Button>
            <Button variant="primary" onClick={complete}>
              Complete task
            </Button>
          </>
        )
      }
    >
      {editing ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="-ml-2">
              <ChevronLeft className="size-4" />
              Back to answers
            </Button>
          </div>
          <p className="bg-info-50 text-info-700 dark:bg-info-500/12 dark:text-info-500 rounded-lg px-3 py-2 text-[13px]">
            Changes here apply to this task only.
            {template ? (
              <>
                {' '}
                To change it for next time, edit{' '}
                <Link to={templatePath(template.id)} onClick={onClose} className="font-semibold underline">
                  {template.name}
                </Link>
                .
              </>
            ) : null}
          </p>
          <QuestionListEditor
            questions={questions}
            onChange={setQuestions}
            expanded={expanded}
            onExpandedChange={setExpanded}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {task.description ? <p className="text-ink-muted text-sm">{task.description}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">
                {answered} of {questions.length} answered
              </Badge>
              {exceptions > 0 ? (
                <Badge tone="fail">
                  {exceptions} exception{exceptions === 1 ? '' : 's'}
                </Badge>
              ) : null}
              {score ? (
                <Badge tone="brand">
                  Score {score.score}/{score.max}
                </Badge>
              ) : null}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Edit questions
            </Button>
          </div>

          {questions.length === 0 ? (
            <p className="text-ink-muted text-sm">This task has no questions. Complete it when it’s done.</p>
          ) : (
            <ol className="space-y-4">
              {questions.map((question, index) => (
                <AnswerField
                  key={question.id}
                  number={index + 1}
                  question={question}
                  answer={answers[question.id]}
                  onChange={(answer) => setAnswer(question.id, answer)}
                  showProblem={showProblems}
                />
              ))}
            </ol>
          )}

          {showProblems && unfinished.length > 0 ? (
            <p className="text-fail-600 dark:text-fail-500 flex items-center gap-1.5 text-[13px] font-medium" role="alert">
              <TriangleAlert className="size-4" />
              {unfinished.length} question{unfinished.length === 1 ? ' needs' : 's need'} finishing before this can be completed.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

function AnswerField({
  number,
  question,
  answer,
  onChange,
  showProblem,
}: {
  number: number
  question: TaskQuestion
  answer: TaskAnswer | undefined
  onChange: (answer: TaskAnswer | undefined) => void
  showProblem: boolean
}) {
  const problem = showProblem ? problemWith(question, answer) : null
  const exception = isException(question, answer)
  const action = actionFor(question, answer)
  const inputId = `answer-input-${question.id}`
  const setValue = (value: string) => onChange(value === '' ? undefined : { ...answer, value })

  return (
    <li
      id={`answer-${question.id}`}
      className={cn(
        'border-line scroll-mt-4 rounded-lg border p-3.5',
        problem && 'border-fail-500',
        exception && !problem && 'border-warn-500',
      )}
    >
      {/* Buttons and the tick box carry their own labels. */}
      <label
        htmlFor={(question.type === 'options' && question.display === 'buttons') || question.type === 'check' ? undefined : inputId}
        className="flex gap-2"
      >
        <span className="text-ink-subtle w-5 shrink-0 text-sm tabular-nums">{number}.</span>
        <span className="text-ink text-sm font-medium">
          {question.label || 'Untitled question'}
          {question.mandatory ? <span className="text-fail-600"> *</span> : null}
          {question.hint ? <span className="text-ink-muted mt-0.5 block text-xs font-normal">{question.hint}</span> : null}
        </span>
      </label>

      <div className="mt-2.5 pl-7">
        {question.type === 'options' ? (
          question.display === 'buttons' ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.label}>
              {question.options.map((option) => {
                const selected = answer?.value === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue(selected ? '' : option.id)}
                    className={cn(
                      'h-10 min-w-16 rounded-lg border px-4 text-sm font-semibold transition-colors',
                      selected
                        ? option.exception
                          ? 'border-fail-600 bg-fail-600 text-white'
                          : 'border-brand-600 bg-brand-600 text-white'
                        : 'border-line-default bg-surface text-ink hover:border-line-strong',
                    )}
                  >
                    {option.label || 'Untitled'}
                  </button>
                )
              })}
            </div>
          ) : (
            <Select id={inputId} value={answer?.value ?? ''} onChange={(event) => setValue(event.target.value)}>
              <option value="">Choose…</option>
              {question.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label || 'Untitled'}
                </option>
              ))}
            </Select>
          )
        ) : null}

        {question.type === 'number' ? (
          <div className="flex items-center gap-2">
            <TextInput
              id={inputId}
              type="text"
              inputMode="decimal"
              value={answer?.value ?? ''}
              onChange={(event) => setValue(event.target.value)}
              invalid={isOutOfRange(question, answer)}
              className="w-32"
            />
            {question.unit ? <span className="text-ink-muted text-sm">{question.unit}</span> : null}
            {question.min !== undefined || question.max !== undefined ? (
              <span className="text-ink-subtle text-xs">
                {question.min !== undefined && question.max !== undefined
                  ? `Expected ${question.min} to ${question.max}`
                  : question.min !== undefined
                    ? `Expected ${question.min} or more`
                    : `Expected ${question.max} or less`}
              </span>
            ) : null}
          </div>
        ) : null}

        {question.type === 'text' ? (
          <Textarea id={inputId} value={answer?.value ?? ''} onChange={(event) => setValue(event.target.value)} className="min-h-16" />
        ) : null}

        {question.type === 'check' ? (
          <Checkbox
            label="Done"
            checked={answer?.value === 'true'}
            onChange={(event) => setValue(event.target.checked ? 'true' : '')}
          />
        ) : null}

        {action !== 'none' ? (
          <div className="mt-3">
            <label htmlFor={`${inputId}-note`} className="text-ink mb-1 block text-[13px] font-medium">
              {isOutOfRange(question, answer)
                ? 'Outside the expected range. What was done about it?'
                : `${chosenOption(question, answer)?.label ?? 'This answer'}: what was done about it?`}
              {action === 'require' ? <span className="text-fail-600"> *</span> : null}
            </label>
            <Textarea
              id={`${inputId}-note`}
              value={answer?.note ?? ''}
              onChange={(event) => answer && onChange({ ...answer, note: event.target.value || undefined })}
              className="min-h-16"
            />
          </div>
        ) : null}

        {problem ? <p className="text-fail-600 dark:text-fail-500 mt-2 text-xs font-medium">{problem}</p> : null}
      </div>
    </li>
  )
}
