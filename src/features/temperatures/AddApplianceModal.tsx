import { useState } from 'react'
import { useStore } from '@/data/store'
import type { MonitoredCategory } from '@/data/types'
import { createId } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Field, ProblemCount, Select, Stepper, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type ApplianceType = Extract<MonitoredCategory, 'fridge' | 'freezer' | 'hot_holding'>

const TYPES: Record<ApplianceType, { label: string; min: number; max: number; failAbove: number | null }> = {
  fridge: { label: 'Fridge', min: 0, max: 5, failAbove: 8 },
  freezer: { label: 'Freezer', min: -25, max: -18, failAbove: -15 },
  hot_holding: { label: 'Hot hold', min: 63, max: 90, failAbove: null },
}

export function AddApplianceModal({ onClose }: { onClose: () => void }) {
  const { data, saveItem } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<ApplianceType>('fridge')
  const [min, setMin] = useState(TYPES.fridge.min)
  const [max, setMax] = useState(TYPES.fridge.max)
  const [failAbove, setFailAbove] = useState<number | null>(TYPES.fridge.failAbove)
  const [submitted, setSubmitted] = useState(false)

  const noName = submitted && name.trim() === ''
  const badRange = submitted && min >= max
  const badFail = submitted && failAbove !== null && failAbove < max
  const problems = [noName, badRange, badFail].filter(Boolean).length

  function chooseType(next: ApplianceType) {
    setType(next)
    setMin(TYPES[next].min)
    setMax(TYPES[next].max)
    setFailAbove(TYPES[next].failAbove)
  }

  function save() {
    setSubmitted(true)
    if (name.trim() === '' || min >= max || (failAbove !== null && failAbove < max)) return
    saveItem({
      id: createId('eq'),
      name: name.trim(),
      category: type,
      location: '',
      minTemp: min,
      maxTemp: max,
      failAbove: failAbove ?? undefined,
      requiredChecks: ['opening', 'closing'],
      active: true,
    })
    toast.success('Appliance added')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="page"
      title="Add appliance"
      footer={
        <Button variant="primary" size="lg" onClick={save}>
          Save appliance
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted text-[13px]">{data.settings.venueName} · Required fields are marked *</p>
        <ProblemCount count={problems}>Enter a name and put the target bounds in ascending order.</ProblemCount>
        <Field label="Name" required htmlFor="appliance-name" error={noName ? 'Enter an appliance name' : undefined}>
          <TextInput
            id="appliance-name"
            autoFocus
            value={name}
            invalid={noName}
            placeholder="e.g. Fridge 3"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Type" required htmlFor="appliance-type" hint="Types: Fridge, Freezer or Hot hold. The values below are editable.">
          <Select
            id="appliance-type"
            value={type}
            onChange={(event) => chooseType(event.target.value as ApplianceType)}
          >
            {(Object.keys(TYPES) as ApplianceType[]).map((key) => (
              <option key={key} value={key}>
                {TYPES[key].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target minimum" htmlFor="appliance-min" error={badRange ? 'Minimum must be below maximum' : undefined}>
          <Stepper id="appliance-min" label="target minimum" unit="°C" value={min} onChange={setMin} invalid={badRange} />
        </Field>
        <Field label="Target maximum" htmlFor="appliance-max">
          <Stepper id="appliance-max" label="target maximum" unit="°C" value={max} onChange={setMax} />
        </Field>
        {failAbove !== null ? (
          <Field label="Fail above" htmlFor="appliance-fail" error={badFail ? 'Fail above can’t be below the target maximum' : undefined}>
            <Stepper id="appliance-fail" label="fail above" unit="°C" value={failAbove} onChange={setFailAbove} invalid={badFail} />
          </Field>
        ) : null}
      </div>
    </Modal>
  )
}
