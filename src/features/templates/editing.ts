/** List and question helpers shared by the template and task editors. */
import type { TaskQuestion } from '@/data/types'
import { createId } from '@/lib/utils'

/** Moves the entry at `index` by `delta` places, leaving the list alone at either end. */
export function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** A copy with new ids all the way down, so it can sit beside the original. */
export function copyQuestion(question: TaskQuestion): TaskQuestion {
  return {
    ...question,
    id: createId('qq'),
    options: question.options.map((option) => ({ ...option, id: createId('qo') })),
  }
}

/** Anchor id for a question, so an outline can jump to it. */
export function questionAnchor(questionId: string): string {
  return `question-${questionId}`
}
