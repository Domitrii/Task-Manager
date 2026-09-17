import { useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Minus, X } from 'lucide-react'
import { useStore } from '@/data/store'
import type { ChecklistResultStatus, ChecklistRun, ChecklistTemplate } from '@/data/types'
import { toISODate } from '@/lib/compliance'
import { cn, createId } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/shared/ProgressRing'
import { useToast } from '@/components/ui/Toast'

const OPTIONS: Array<{ value: ChecklistResultStatus; label: string; icon: typeof Check }> = [
  { value: 'pass', label: 'Pass', icon: Check },
  { value: 'fail', label: 'Fail', icon: X },
  { value: 'na', label: 'N/A', icon: Minus },
]

/**
 * Completing a checklist. Every item starts unanswered rather than pre-passed —
 * a pre-ticked sheet is the classic way compliance records stop meaning anything.
 */
export function ChecklistRunModal({
  template,
  existing,
  onClose,
}: {
  template: ChecklistTemplate | undefined
  existing?: ChecklistRun
  onClose: () => void
}) {
  const { data, activeStaffId, recordChecklistRun } = useStore()
  const toast = useToast()

  // Mounted per run, so state seeds once: blank for a new run, or the saved
  // answers when viewing a completed record.
  const [results, setResults] = useState<Record<string, ChecklistResultStatus>>(() =>
    existing ? Object.fromEntries(existing.results.map((result) => [result.itemId, result.status])) : {},
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    existing
      ? Object.fromEntries(
          existing.results
            .filter((result) => result.note)
            .map((result) => [result.itemId, result.note as string]),
        )
      : {},
  )
  const [completedBy, setCompletedBy] = useState(existing?.completedBy ?? activeStaffId)
  const [runNotes, setRunNotes] = useState(existing?.notes ?? '')
  const [submitted, setSubmitted] = useState(false)

  const answered = useMemo(
    () => (template ? template.items.filter((item) => results[item.id]).length : 0),
    [template, results],
  )
  const failed = useMemo(
    () => (template ? template.items.filter((item) => results[item.id] === 'fail') : []),
    [template, results],
  )
  const missingNotes = failed.filter((item) => !notes[item.id]?.trim())

  if (!template) return null

  const readOnly = Boolean(existing)
  const complete = answered === template.items.length
  const canSave = complete && missingNotes.length === 0 && completedBy !== ''

  function handleSave() {
    if (!template) return
    setSubmitted(true)
    if (!canSave) return

    const run: ChecklistRun = {
      id: createId('cr'),
      templateId: template.id,
      date: toISODate(new Date()),
      completedBy,
      completedAt: new Date().toISOString(),
      results: template.items.map((item) => ({
        itemId: item.id,
        status: results[item.id],
        note: notes[item.id]?.trim() || undefined,
      })),
      notes: runNotes.trim() || undefined,
    }

    recordChecklistRun(run)
    if (failed.length > 0) {
      toast.error(
        `${template.name} completed with ${failed.length} failure${failed.length === 1 ? '' : 's'}`,
        'Critical failures have been raised as food safety issues.',
      )
    } else {
      toast.success(`${template.name} completed`, `All ${template.items.length} checks passed.`)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={template.name}
      description={
        readOnly
          ? 'Completed record — kept for your food safety file.'
          : `${template.items.length} checks · answer every item before signing off.`
      }
      size="lg"
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave}>
              Complete checklist
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {!readOnly ? (
          <div>
            <div className="text-ink-muted mb-1.5 flex items-center justify-between text-[13px]">
              <span>
                {answered} of {template.items.length} answered
              </span>
              {failed.length > 0 ? (
                <Badge tone="fail">{failed.length} failing</Badge>
              ) : complete ? (
                <Badge tone="pass">Ready to sign off</Badge>
              ) : null}
            </div>
            <ProgressBar
              value={(answered / template.items.length) * 100}
              tone={failed.length > 0 ? 'warn' : 'brand'}
            />
          </div>
        ) : null}

        <ul className="space-y-2">
          {template.items.map((item) => {
            const status = results[item.id]
            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-lg border p-3.5',
                  status === 'fail'
                    ? 'border-fail-500/35 bg-fail-50/50 dark:bg-fail-500/6'
                    : status === 'pass'
                      ? 'border-pass-500/25 bg-pass-50/40 dark:bg-pass-500/6'
                      : 'border-line',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-sm leading-5 font-medium">
                      {item.label}
                      {item.critical ? (
                        <span className="text-fail-600 dark:text-fail-500 ml-1.5 text-[11px] font-semibold uppercase">
                          Critical
                        </span>
                      ) : null}
                    </p>
                    {item.hint ? <p className="text-ink-muted mt-0.5 text-xs">{item.hint}</p> : null}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {OPTIONS.map((option) => {
                      const Icon = option.icon
                      const active = status === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={readOnly}
                          onClick={() =>
                            setResults((current) => ({ ...current, [item.id]: option.value }))
                          }
                          className={cn(
                            'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-default',
                            active && option.value === 'pass' && 'border-pass-600 bg-pass-600 text-white',
                            active && option.value === 'fail' && 'border-fail-600 bg-fail-600 text-white',
                            active && option.value === 'na' && 'border-line-strong bg-surface-muted text-ink',
                            !active && 'border-line-default text-ink-muted hover:border-line-strong hover:text-ink',
                          )}
                        >
                          <Icon className="size-3.5" />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {status === 'fail' ? (
                  <div className="mt-3">
                    <TextInput
                      value={notes[item.id] ?? ''}
                      disabled={readOnly}
                      placeholder="What was wrong and what did you do about it?"
                      invalid={submitted && !notes[item.id]?.trim()}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                  </div>
                ) : notes[item.id] ? (
                  <p className="text-ink-muted mt-2 text-xs">{notes[item.id]}</p>
                ) : null}
              </li>
            )
          })}
        </ul>

        {submitted && missingNotes.length > 0 ? (
          <p className="text-fail-600 dark:text-fail-500 flex items-center gap-1.5 text-[13px]">
            <AlertTriangle className="size-4" />
            Add a note for every failed item before signing off.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Completed by" required htmlFor="checklist-staff">
            <Select
              id="checklist-staff"
              value={completedBy}
              disabled={readOnly}
              onChange={(event) => setCompletedBy(event.target.value)}
            >
              {data.staff
                .filter((person) => person.active)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" hint="Optional — anything else worth recording" htmlFor="checklist-notes">
          <Textarea
            id="checklist-notes"
            value={runNotes}
            disabled={readOnly}
            onChange={(event) => setRunNotes(event.target.value)}
          />
        </Field>

        {readOnly ? (
          <p className="text-ink-muted flex items-center gap-1.5 text-[13px]">
            <CheckCircle2 className="text-pass-600 dark:text-pass-500 size-4" />
            This record cannot be edited once signed off.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
