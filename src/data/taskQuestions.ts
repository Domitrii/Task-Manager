/** Building blocks for task questions, shared by the template library and the editors. */
import { createId } from '@/lib/utils'
import type { OptionAction, QuestionOption, TaskQuestion } from './types'

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
