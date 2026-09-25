import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Beer,
  Check,
  ChevronLeft,
  Coffee,
  Croissant,
  type LucideIcon,
  Minus,
  Plus,
  ShoppingBag,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react'
import {
  MAX_UNITS,
  UNIT_CATEGORIES,
  buildDataFromSetupPack,
  packDefaults,
  planSetup,
  planWindows,
  type SetupAnswers,
} from '@/data/buildFromSetupPack'
import { SETUP_PACKS, getSetupPack, type SetupPack, type SetupPackId, type UnitCategory } from '@/data/setupPacks'
import { useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, TextInput, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { FocusFrame, FocusHeading } from '@/components/layout/FocusFrame'
import { ReviewStep } from './ReviewStep'

const STEPS = [
  { title: 'Your venue', description: 'This goes at the top of every record you export.' },
  { title: 'What kind of venue is it?', description: 'You’ll start with the equipment and checklists that suit it.' },
  { title: 'Your kitchen', description: 'What you run and when you’re open.' },
  { title: 'Check and create', description: 'Untick anything you don’t need. You can change all of it later in Settings.' },
]

const PACK_ICONS: Record<SetupPackId, LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  pub: Beer,
  takeaway: ShoppingBag,
  bakery: Croissant,
}

const UNIT_LABELS: Record<UnitCategory, string> = {
  fridge: 'Fridges',
  freezer: 'Freezers',
  hot_holding: 'Hot-holding units',
}

const isTime = (value: string) => /^\d{2}:\d{2}$/.test(value)

/** Larger text than the rest of the app so iOS doesn't zoom in on focus. */
const INPUT = 'h-12 text-base'

export function SetupFlow() {
  const { data, hasData, replaceData } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [packId, setPackId] = useState<SetupPackId | null>(null)
  const [answers, setAnswers] = useState<SetupAnswers>(() => ({
    venueName: '',
    address: '',
    managerName: '',
    ...packDefaults(SETUP_PACKS[0]),
    excluded: [],
  }))

  const pack = packId ? getSetupPack(packId) : null
  const complete = [
    answers.venueName.trim() !== '' && answers.managerName.trim() !== '',
    pack !== null,
    isTime(answers.openingTime) && isTime(answers.closingTime),
  ]

  // The step lives in the URL so the phone's back gesture goes back a step.
  // Nobody lands past a step they haven't answered, e.g. after a refresh.
  const requested = Math.min(Math.max(Number(params.get('step')) || 1, 1), STEPS.length)
  const firstIncomplete = complete.findIndex((done) => !done)
  const step = firstIncomplete === -1 ? requested : Math.min(requested, firstIncomplete + 1)

  useEffect(() => {
    if (step !== requested) setParams(step === 1 ? {} : { step: String(step) }, { replace: true })
  }, [step, requested, setParams])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  function update(changes: Partial<SetupAnswers>) {
    setAnswers((current) => ({ ...current, ...changes }))
  }

  function choosePack(id: SetupPackId) {
    if (id === packId) return
    setPackId(id)
    // A different pack brings its own suggested counts and hours.
    update({ ...packDefaults(getSetupPack(id)), excluded: [] })
  }

  function back() {
    if (step === 1) navigate(hasData ? '/settings' : '/setup')
    else navigate(-1)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < STEPS.length) {
      if (complete[step - 1]) setParams({ step: String(step + 1) })
      return
    }
    if (!pack) return
    const venue = buildDataFromSetupPack(pack, answers)
    replaceData(venue)
    toast.success(
      `${venue.settings.venueName} is ready`,
      `${venue.items.length} things to monitor and ${venue.checklistTemplates.length} checklists.`,
    )
    navigate('/', { replace: true })
  }

  const plan = useMemo(() => (pack ? planSetup(pack, answers) : null), [pack, answers])
  const excluded = new Set(answers.excluded)
  const included = plan
    ? {
        items: plan.items.filter((entry) => !excluded.has(entry.key)).length,
        checklists: plan.checklists.filter((entry) => !excluded.has(entry.key)).length,
      }
    : null

  return (
    <FocusFrame
      onSubmit={handleSubmit}
      top={
        <>
          <IconButton label={step === 1 ? 'Leave setup' : 'Back'} onClick={back} className="-ml-2">
            <ChevronLeft className="size-5" />
          </IconButton>
          <ol className="flex flex-1 gap-1.5" aria-label={`Step ${step} of ${STEPS.length}`}>
            {STEPS.map((entry, index) => (
              <li
                key={entry.title}
                aria-current={index + 1 === step ? 'step' : undefined}
                className={cn('h-1.5 flex-1 rounded-full', index < step ? 'bg-brand-600' : 'bg-line-default')}
              >
                <span className="sr-only">{entry.title}</span>
              </li>
            ))}
          </ol>
          <span className="text-ink-muted tabular shrink-0 text-sm font-medium">
            {step} of {STEPS.length}
          </span>
          {hasData ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="-mr-2">
              Cancel
            </Button>
          ) : null}
        </>
      }
      actions={
        step < STEPS.length ? (
          <Button type="submit" variant="primary" size="lg" disabled={!complete[step - 1]} className="w-full sm:w-auto sm:min-w-44">
            Continue
          </Button>
        ) : (
          <>
            {included ? (
              <p className="text-ink-muted text-center text-sm sm:mr-auto sm:text-left">
                {included.items} to monitor, {included.checklists} {included.checklists === 1 ? 'checklist' : 'checklists'}
              </p>
            ) : null}
            <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto sm:min-w-44">
              Create venue
            </Button>
          </>
        )
      }
    >
      <FocusHeading title={STEPS[step - 1].title} description={STEPS[step - 1].description} />

      {step === 1 ? <VenueStep answers={answers} onChange={update} /> : null}
      {step === 2 ? <PackStep value={packId} onChange={choosePack} /> : null}
      {step === 3 && pack ? <KitchenStep pack={pack} answers={answers} onChange={update} /> : null}
      {step === 4 && pack && plan ? (
        <>
          {hasData ? (
            <div
              role="note"
              className="border-warn-500/30 bg-warn-50 text-warn-700 dark:bg-warn-500/10 dark:text-warn-500 mb-6 flex gap-2.5 rounded-xl border p-3.5 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                Creating this venue replaces everything on this device, including {data.temperatureLogs.length}{' '}
                temperature records, {data.deliveries.length} deliveries and {data.checklistRuns.length} checklist
                runs.
              </p>
            </div>
          ) : null}
          <ReviewStep
            pack={pack}
            answers={answers}
            plan={plan}
            onToggle={(key, include) =>
              update({
                excluded: include
                  ? answers.excluded.filter((entry) => entry !== key)
                  : [...answers.excluded, key],
              })
            }
          />
        </>
      ) : null}
    </FocusFrame>
  )
}

/* -------------------------------------------------------------------------- */

function VenueStep({ answers, onChange }: { answers: SetupAnswers; onChange: (changes: Partial<SetupAnswers>) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Venue name" required htmlFor="setup-venue">
        <TextInput
          id="setup-venue"
          className={INPUT}
          autoComplete="organization"
          enterKeyHint="next"
          placeholder="e.g. The Copper Larder"
          value={answers.venueName}
          onChange={(event) => onChange({ venueName: event.target.value })}
        />
      </Field>
      <Field label="Address" hint="Optional" htmlFor="setup-address">
        <Textarea
          id="setup-address"
          rows={2}
          className="text-base"
          autoComplete="street-address"
          placeholder="Street, town and postcode"
          value={answers.address}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </Field>
      <Field
        label="Your name"
        required
        hint="You’ll be added as the manager. Add the rest of the team later in Settings."
        htmlFor="setup-manager"
      >
        <TextInput
          id="setup-manager"
          className={INPUT}
          autoComplete="name"
          enterKeyHint="next"
          value={answers.managerName}
          onChange={(event) => onChange({ managerName: event.target.value })}
        />
      </Field>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function PackStep({ value, onChange }: { value: SetupPackId | null; onChange: (id: SetupPackId) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Type of venue</legend>
      <div className="space-y-2.5">
        {SETUP_PACKS.map((option) => {
          const Icon = PACK_ICONS[option.id]
          const checked = value === option.id
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                checked
                  ? 'border-brand-600 bg-brand-50 ring-brand-600 dark:bg-brand-950 ring-1'
                  : 'bg-surface border-line-default hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name="setup-pack"
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl',
                  checked ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted',
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ink block text-base font-semibold">{option.name}</span>
                <span className="text-ink-muted mt-0.5 block text-sm">{option.description}</span>
                <span className="text-ink-subtle mt-1.5 block text-xs">{packSummary(option)}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong',
                )}
              >
                {checked ? <Check className="size-3 text-white" strokeWidth={3.5} /> : null}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function packSummary(pack: SetupPack): string {
  const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`
  return [
    count(pack.units.fridge.defaultCount, 'fridge', 'fridges'),
    count(pack.units.freezer.defaultCount, 'freezer', 'freezers'),
    count(pack.checklists.length, 'checklist', 'checklists'),
  ].join(' · ')
}

/* -------------------------------------------------------------------------- */

function KitchenStep({
  pack,
  answers,
  onChange,
}: {
  pack: SetupPack
  answers: SetupAnswers
  onChange: (changes: Partial<SetupAnswers>) => void
}) {
  const hoursValid = isTime(answers.openingTime) && isTime(answers.closingTime)
  const windows = hoursValid ? planWindows(pack, answers.openingTime, answers.closingTime) : []
  const opening = windows.find((entry) => entry.window.period === 'opening')?.window
  const closing = windows.find((entry) => entry.window.period === 'closing')?.window
  const overnight = hoursValid && answers.closingTime <= answers.openingTime

  return (
    <div className="space-y-9">
      <Section title="Equipment" description="Each one gets its own daily temperature checks.">
        <div className="bg-surface border-line divide-line divide-y rounded-xl border">
          {UNIT_CATEGORIES.map((category) => (
            <CountRow
              key={category}
              label={UNIT_LABELS[category]}
              unitName={pack.units[category].name}
              value={answers.counts[category]}
              onChange={(value) => onChange({ counts: { ...answers.counts, [category]: value } })}
            />
          ))}
        </div>
        {pack.extras.length > 0 ? (
          <p className="text-ink-muted mt-2.5 text-[13px]">
            Also included: {pack.extras.map((extra) => extra.name).join(', ')}. You can untick{' '}
            {pack.extras.length === 1 ? 'it' : 'them'} on the last step.
          </p>
        ) : null}
      </Section>

      <Section
        title="Do you cook from raw?"
        description="Raw meat, poultry, fish or eggs cooked on site. Adds cooking and cooling probes, and the checks that go with them."
      >
        <div role="radiogroup" aria-label="Do you cook from raw?" className="grid grid-cols-2 gap-2.5">
          {[true, false].map((option) => (
            <label
              key={String(option)}
              className={cn(
                'flex h-12 cursor-pointer items-center justify-center rounded-xl border text-base font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                answers.cooksFromRaw === option
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'bg-surface border-line-default text-ink hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name="setup-raw"
                checked={answers.cooksFromRaw === option}
                onChange={() => onChange({ cooksFromRaw: option })}
                className="sr-only"
              />
              {option ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Opening hours" description="When customers can come in. Opening and closing checks are timed around these.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens" htmlFor="setup-open">
            <TextInput
              id="setup-open"
              type="time"
              className={cn(INPUT, 'tabular')}
              invalid={!isTime(answers.openingTime)}
              value={answers.openingTime}
              onChange={(event) => onChange({ openingTime: event.target.value })}
            />
          </Field>
          <Field label="Closes" htmlFor="setup-close">
            <TextInput
              id="setup-close"
              type="time"
              className={cn(INPUT, 'tabular')}
              invalid={!isTime(answers.closingTime)}
              value={answers.closingTime}
              onChange={(event) => onChange({ closingTime: event.target.value })}
            />
          </Field>
        </div>
        <p className="text-ink-muted mt-3 text-[13px]" aria-live="polite">
          {!hoursValid
            ? 'Enter both times to carry on.'
            : `${overnight ? 'Closes after midnight. ' : ''}Opening checks ${opening?.startTime}–${opening?.endTime}, closing checks ${closing?.startTime}–${closing?.endTime}.`}
        </p>
      </Section>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-ink text-[17px] font-bold">{title}</h2>
      {description ? <p className="text-ink-muted mt-0.5 mb-3 text-sm">{description}</p> : <div className="mb-3" />}
      {children}
    </section>
  )
}

function CountRow({
  label,
  unitName,
  value,
  onChange,
}: {
  label: string
  unitName: string
  value: number
  onChange: (value: number) => void
}) {
  const names = value === 0 ? 'None' : value === 1 ? `${unitName} 1` : `${unitName} 1 to ${unitName} ${value}`
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-ink text-[15px] font-semibold">{label}</p>
        <p className="text-ink-muted truncate text-[13px]">{names}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
        <IconButton
          label={`Fewer ${label.toLowerCase()}`}
          variant="secondary"
          className="size-11 rounded-xl"
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          <Minus className="size-4" />
        </IconButton>
        <output aria-live="polite" className="text-ink tabular w-9 text-center text-lg font-bold">
          {value}
        </output>
        <IconButton
          label={`More ${label.toLowerCase()}`}
          variant="secondary"
          className="size-11 rounded-xl"
          disabled={value >= MAX_UNITS}
          onClick={() => onChange(value + 1)}
        >
          <Plus className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
