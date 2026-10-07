/**
 * What a task's answers add up to: which are exceptions, which still need
 * something before the task can be completed, and the score.
 */
import type { OptionAction, Task, TaskAnswer, TaskQuestion } from '@/data/types'

export function chosenOption(question: TaskQuestion, answer: TaskAnswer | undefined) {
  if (question.type !== 'options' || !answer) return undefined
  return question.options.find((option) => option.id === answer.value)
}

export function isAnswered(question: TaskQuestion, answer: TaskAnswer | undefined): boolean {
  if (!answer) return false
  switch (question.type) {
    case 'options':
      return chosenOption(question, answer) !== undefined
    case 'number':
      return answer.value.trim() !== '' && Number.isFinite(Number(answer.value))
    case 'check':
      return answer.value === 'true'
    case 'text':
      return answer.value.trim() !== ''
  }
}

/** A number outside the question's range. */
export function isOutOfRange(question: TaskQuestion, answer: TaskAnswer | undefined): boolean {
  if (question.type !== 'number' || !isAnswered(question, answer)) return false
  const value = Number(answer?.value)
  return (question.min !== undefined && value < question.min) || (question.max !== undefined && value > question.max)
}

export function isException(question: TaskQuestion, answer: TaskAnswer | undefined): boolean {
  return chosenOption(question, answer)?.exception === true || isOutOfRange(question, answer)
}

/** Whether the answer asks for a note on what was done. Out-of-range readings always need one. */
export function actionFor(question: TaskQuestion, answer: TaskAnswer | undefined): OptionAction {
  if (isOutOfRange(question, answer)) return 'require'
  return chosenOption(question, answer)?.action ?? 'none'
}

/** What stops this question being complete, or null when nothing does. */
export function problemWith(question: TaskQuestion, answer: TaskAnswer | undefined): string | null {
  if (!isAnswered(question, answer)) return question.mandatory ? 'Needs an answer' : null
  if (actionFor(question, answer) === 'require' && !answer?.note?.trim()) return 'Say what was done about it'
  return null
}

export function unfinishedQuestions(task: Pick<Task, 'questions' | 'answers'>): TaskQuestion[] {
  return (task.questions ?? []).filter((question) => problemWith(question, task.answers?.[question.id]) !== null)
}

export function exceptionCount(task: Pick<Task, 'questions' | 'answers'>): number {
  return (task.questions ?? []).filter((question) => isException(question, task.answers?.[question.id])).length
}

/** Scored questions only; null when the task has none. */
export function taskScore(task: Pick<Task, 'questions' | 'answers'>): { score: number; max: number } | null {
  const scored = (task.questions ?? []).filter((question) => question.type === 'options' && question.scored)
  if (scored.length === 0) return null
  let score = 0
  let max = 0
  for (const question of scored) {
    max += Math.max(0, ...question.options.map((option) => option.score))
    score += chosenOption(question, task.answers?.[question.id])?.score ?? 0
  }
  return { score, max }
}

const TYPE_LABELS: Record<TaskQuestion['type'], string> = {
  options: 'Multiple choice',
  text: 'Text',
  number: 'Number',
  check: 'Tick box',
}

export function questionTypeLabel(type: TaskQuestion['type']): string {
  return TYPE_LABELS[type]
}

/** One line describing a question, e.g. "Yes / No · Mandatory". */
export function questionSummary(question: TaskQuestion): string {
  const parts: string[] = []
  if (question.type === 'options') {
    parts.push(question.options.map((option) => option.label || 'Untitled').join(' / ') || 'No options yet')
  } else if (question.type === 'number') {
    const range =
      question.min !== undefined && question.max !== undefined
        ? `${question.min} to ${question.max}`
        : question.min !== undefined
          ? `${question.min} or more`
          : question.max !== undefined
            ? `${question.max} or less`
            : null
    parts.push(['Number', range, question.unit].filter(Boolean).join(' '))
  } else {
    parts.push(TYPE_LABELS[question.type])
  }
  if (question.mandatory) parts.push('Mandatory')
  if (question.scored) parts.push('Scored')
  return parts.join(' · ')
}
