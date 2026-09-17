import { useState } from 'react'
import { Database, Pencil, Plug, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { CATEGORY_LABELS } from '@/config/navigation'
import { useStore } from '@/data/store'
import type {
  CheckPeriod,
  MonitoredCategory,
  MonitoredItem,
  StaffMember,
  StaffRole,
  Supplier,
} from '@/data/types'
import { CHECK_PERIOD_ORDER, formatRange } from '@/lib/compliance'
import { cn, createId, initialsOf, titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Checkbox, Field, Select, TextInput, Textarea, Toggle } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'

type TabKey = 'venue' | 'equipment' | 'staff' | 'suppliers' | 'data'

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as MonitoredCategory[]
const ROLES: StaffRole[] = ['manager', 'head_chef', 'chef', 'supervisor', 'front_of_house', 'kp']

export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('venue')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Everything the compliance rules are built from: equipment ranges, check windows, the team and your suppliers."
      />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'venue', label: 'Venue' },
          { value: 'equipment', label: 'Equipment' },
          { value: 'staff', label: 'Team' },
          { value: 'suppliers', label: 'Suppliers' },
          { value: 'data', label: 'Data' },
        ]}
      />

      {tab === 'venue' ? <VenueSettingsTab /> : null}
      {tab === 'equipment' ? <EquipmentTab /> : null}
      {tab === 'staff' ? <StaffTab /> : null}
      {tab === 'suppliers' ? <SuppliersTab /> : null}
      {tab === 'data' ? <DataTab /> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function VenueSettingsTab() {
  const { data, updateSettings } = useStore()
  const { settings } = data

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Venue details" description="Shown on exported records" />
        <CardBody className="space-y-4">
          <Field label="Venue name" htmlFor="venue-name">
            <TextInput
              id="venue-name"
              value={settings.venueName}
              onChange={(event) => updateSettings({ venueName: event.target.value })}
            />
          </Field>
          <Field label="Site reference" htmlFor="venue-ref">
            <TextInput
              id="venue-ref"
              value={settings.siteReference}
              onChange={(event) => updateSettings({ siteReference: event.target.value })}
            />
          </Field>
          <Field label="Address" htmlFor="venue-address">
            <Textarea
              id="venue-address"
              value={settings.address}
              onChange={(event) => updateSettings({ address: event.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Check windows"
            description="A check counts towards a period when it is recorded inside that window"
          />
          <CardBody className="space-y-2.5">
            <div className="text-ink-muted grid grid-cols-[1fr_7rem_7rem] gap-3 text-[11px] font-semibold tracking-wide uppercase">
              <span>Period</span>
              <span>From</span>
              <span>To</span>
            </div>
            {settings.periods.map((window) => (
              <div key={window.period} className="grid grid-cols-[1fr_7rem_7rem] items-center gap-3">
                <label htmlFor={`start-${window.period}`} className="text-ink text-[13px] font-medium">
                  {window.label}
                </label>
                <TextInput
                  id={`start-${window.period}`}
                  type="time"
                  aria-label={`${window.label} window starts`}
                  value={window.startTime}
                  onChange={(event) =>
                    updateSettings({
                      periods: settings.periods.map((entry) =>
                        entry.period === window.period
                          ? { ...entry, startTime: event.target.value }
                          : entry,
                      ),
                    })
                  }
                />
                <TextInput
                  type="time"
                  aria-label={`${window.label} window ends`}
                  value={window.endTime}
                  onChange={(event) =>
                    updateSettings({
                      periods: settings.periods.map((entry) =>
                        entry.period === window.period
                          ? { ...entry, endTime: event.target.value }
                          : entry,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Delivery temperature limits"
            description="Goods arriving above these are flagged for rejection"
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Chilled, produce & bakery" hint="Maximum on arrival" htmlFor="limit-chilled">
              <TextInput
                id="limit-chilled"
                type="number"
                step="0.5"
                className="tabular"
                value={settings.chilledDeliveryMaxTemp}
                onChange={(event) =>
                  updateSettings({ chilledDeliveryMaxTemp: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Frozen" hint="Maximum on arrival" htmlFor="limit-frozen">
              <TextInput
                id="limit-frozen"
                type="number"
                step="0.5"
                className="tabular"
                value={settings.frozenDeliveryMaxTemp}
                onChange={(event) =>
                  updateSettings({ frozenDeliveryMaxTemp: Number(event.target.value) })
                }
              />
            </Field>
            <p className="text-ink-subtle sm:col-span-2 text-xs">
              Changes save as you type and apply to every check from now on. Records already saved keep the
              limits that were in force when they were taken.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function EquipmentTab() {
  const { data, deleteItem } = useStore()
  const [editing, setEditing] = useState<MonitoredItem | undefined>(undefined)
  const [creating, setCreating] = useState(false)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Monitored equipment & processes"
        description="Safe ranges and check schedules used by every temperature page"
        action={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-4" />
            Add equipment
          </Button>
        }
      />
      <TableWrap>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Location</Th>
            <Th>Safe range</Th>
            <Th>Checks per day</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <Tr key={item.id}>
              <Td>
                <span className="text-ink block text-[13px] font-medium">{item.name}</span>
                {item.reference ? (
                  <span className="text-ink-subtle text-[11px]">{item.reference}</span>
                ) : null}
              </Td>
              <Td>
                <Badge tone="neutral">{CATEGORY_LABELS[item.category]}</Badge>
              </Td>
              <Td>
                <span className="text-ink-muted text-[13px]">{item.location}</span>
              </Td>
              <Td>
                <span className="tabular text-ink text-[13px]">{formatRange(item)}</span>
              </Td>
              <Td>
                <span className="text-ink-muted text-[13px]">
                  {item.requiredChecks.length === 0
                    ? 'Ad-hoc'
                    : item.requiredChecks.map((period) => titleCase(period)).join(', ')}
                </span>
              </Td>
              <Td>{item.active ? <Badge tone="pass">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</Td>
              <Td className="text-right">
                <span className="flex justify-end gap-1">
                  <IconButton label="Edit equipment" size="sm" onClick={() => setEditing(item)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label="Delete equipment" size="sm" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </span>
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableWrap>

      {editing || creating ? (
        <EquipmentModal
          item={editing}
          onClose={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        />
      ) : null}
    </Card>
  )
}

function EquipmentModal({ item, onClose }: { item?: MonitoredItem; onClose: () => void }) {
  const { saveItem } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState<MonitoredItem>(
    item ?? {
      id: createId('eq'),
      name: '',
      category: 'fridge',
      location: '',
      minTemp: 0,
      maxTemp: 5,
      requiredChecks: ['opening', 'closing'],
      active: true,
    },
  )

  function toggleCheck(period: CheckPeriod) {
    setDraft((current) => ({
      ...current,
      requiredChecks: current.requiredChecks.includes(period)
        ? current.requiredChecks.filter((entry) => entry !== period)
        : [...current.requiredChecks, period],
    }))
  }

  function handleSave() {
    if (!draft.name.trim()) return
    saveItem({ ...draft, name: draft.name.trim(), location: draft.location.trim() || 'Unassigned' })
    toast.success(item ? 'Equipment updated' : 'Equipment added', `${draft.name} is now monitored.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Edit equipment' : 'Add equipment'}
      description="Ranges here drive every pass/fail decision in the app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!draft.name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required htmlFor="eq-name">
          <TextInput
            id="eq-name"
            value={draft.name}
            autoFocus
            placeholder="e.g. Walk-in Fridge 3"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="eq-category">
            <Select
              id="eq-category"
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value as MonitoredCategory })
              }
            >
              {CATEGORY_VALUES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location" htmlFor="eq-location">
            <TextInput
              id="eq-location"
              value={draft.location}
              placeholder="e.g. Main Kitchen"
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            />
          </Field>
          <Field label="Minimum °C" hint="Leave blank for no lower limit" htmlFor="eq-min">
            <TextInput
              id="eq-min"
              type="number"
              step="0.5"
              className="tabular"
              value={draft.minTemp ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, minTemp: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Maximum °C" hint="Leave blank for no upper limit" htmlFor="eq-max">
            <TextInput
              id="eq-max"
              type="number"
              step="0.5"
              className="tabular"
              value={draft.maxTemp ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, maxTemp: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </Field>
        </div>

        <Field label="Required checks" hint="Leave all unticked for ad-hoc probing">
          <div className="flex flex-wrap gap-2">
            {CHECK_PERIOD_ORDER.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => toggleCheck(period)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
                  draft.requiredChecks.includes(period)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line-default text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {titleCase(period)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notes" hint="Optional" htmlFor="eq-notes">
          <Textarea
            id="eq-notes"
            value={draft.notes ?? ''}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })}
          />
        </Field>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-ink text-[13px] font-medium">Active</p>
            <p className="text-ink-muted text-xs">Inactive equipment is hidden from check lists.</p>
          </div>
          <Toggle
            label="Active"
            checked={draft.active}
            onChange={(value) => setDraft({ ...draft, active: value })}
          />
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */

function StaffTab() {
  const { data, saveStaff } = useStore()
  const [editing, setEditing] = useState<StaffMember | undefined>(undefined)
  const [creating, setCreating] = useState(false)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Team"
        description="Anyone who records a check, signs off a checklist or receives a delivery"
        action={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-4" />
            Add team member
          </Button>
        }
      />
      <ul className="divide-line divide-y">
        {data.staff.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Avatar person={person} />
            <div className="min-w-0 flex-1">
              <p className="text-ink text-sm font-medium">{person.name}</p>
              <p className="text-ink-muted text-xs">{titleCase(person.role)}</p>
            </div>
            {person.active ? <Badge tone="pass">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
            <Toggle
              label={`Toggle ${person.name}`}
              checked={person.active}
              onChange={(value) => saveStaff({ ...person, active: value })}
            />
            <IconButton label="Edit team member" size="sm" onClick={() => setEditing(person)}>
              <Pencil className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>

      {editing || creating ? (
        <StaffModal
          member={editing}
          onClose={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        />
      ) : null}
    </Card>
  )
}

function StaffModal({ member, onClose }: { member?: StaffMember; onClose: () => void }) {
  const { saveStaff } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState<StaffMember>(
    member ?? { id: createId('st'), name: '', role: 'chef', initials: '', active: true },
  )

  function handleSave() {
    if (!draft.name.trim()) return
    const name = draft.name.trim()
    saveStaff({ ...draft, name, initials: draft.initials.trim() || initialsOf(name) })
    toast.success(member ? 'Team member updated' : 'Team member added', name)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={member ? 'Edit team member' : 'Add team member'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!draft.name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required htmlFor="staff-name">
          <TextInput
            id="staff-name"
            value={draft.name}
            autoFocus
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label="Role" htmlFor="staff-role">
          <Select
            id="staff-role"
            value={draft.role}
            onChange={(event) => setDraft({ ...draft, role: event.target.value as StaffRole })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {titleCase(role)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sign-off PIN" hint="Optional — 4 digits" htmlFor="staff-pin">
          <TextInput
            id="staff-pin"
            inputMode="numeric"
            maxLength={4}
            className="tabular"
            value={draft.pin ?? ''}
            onChange={(event) => setDraft({ ...draft, pin: event.target.value || undefined })}
          />
        </Field>
        <Checkbox
          label="Active"
          description="Inactive people no longer appear in the sign-off lists"
          checked={draft.active}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
        />
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */

function SuppliersTab() {
  const { data, saveSupplier } = useStore()
  const [editing, setEditing] = useState<Supplier | undefined>(undefined)
  const [creating, setCreating] = useState(false)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Suppliers"
        description="Who you receive from — used on every delivery record"
        action={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-4" />
            Add supplier
          </Button>
        }
      />
      <TableWrap>
        <thead>
          <tr>
            <Th>Supplier</Th>
            <Th>Typical goods</Th>
            <Th>Contact</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {data.suppliers.map((supplier) => (
            <Tr key={supplier.id}>
              <Td>
                <span className="text-ink text-[13px] font-medium">{supplier.name}</span>
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  {supplier.categories.map((category) => (
                    <Badge key={category} tone="neutral">
                      {titleCase(category)}
                    </Badge>
                  ))}
                </span>
              </Td>
              <Td>
                <span className="text-ink-muted text-[13px]">{supplier.contactName ?? '—'}</span>
                {supplier.phone ? (
                  <span className="text-ink-subtle block text-[11px]">{supplier.phone}</span>
                ) : null}
              </Td>
              <Td>
                {supplier.active ? <Badge tone="pass">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
              </Td>
              <Td className="text-right">
                <IconButton label="Edit supplier" size="sm" onClick={() => setEditing(supplier)}>
                  <Pencil className="size-4" />
                </IconButton>
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableWrap>

      {editing || creating ? (
        <SupplierModal
          supplier={editing}
          onSave={saveSupplier}
          onClose={() => {
            setEditing(undefined)
            setCreating(false)
          }}
        />
      ) : null}
    </Card>
  )
}

function SupplierModal({
  supplier,
  onSave,
  onClose,
}: {
  supplier?: Supplier
  onSave: (supplier: Supplier) => void
  onClose: () => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Supplier>(
    supplier ?? { id: createId('sup'), name: '', categories: ['chilled'], active: true },
  )

  function handleSave() {
    if (!draft.name.trim()) return
    onSave({ ...draft, name: draft.name.trim() })
    toast.success(supplier ? 'Supplier updated' : 'Supplier added', draft.name)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!draft.name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Supplier name" required htmlFor="sup-name">
          <TextInput
            id="sup-name"
            value={draft.name}
            autoFocus
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label="Contact" hint="Optional" htmlFor="sup-contact">
          <TextInput
            id="sup-contact"
            value={draft.contactName ?? ''}
            onChange={(event) => setDraft({ ...draft, contactName: event.target.value || undefined })}
          />
        </Field>
        <Field label="Phone" hint="Optional" htmlFor="sup-phone">
          <TextInput
            id="sup-phone"
            value={draft.phone ?? ''}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value || undefined })}
          />
        </Field>
        <Checkbox
          label="Active"
          checked={draft.active}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
        />
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */

function DataTab() {
  const { data, resetDemoData } = useStore()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)

  const counts = [
    ['Temperature records', data.temperatureLogs.length],
    ['Deliveries', data.deliveries.length],
    ['Checklist runs', data.checklistRuns.length],
    ['Food safety issues', data.issues.length],
    ['Stock items', data.stock.length],
    ['Tasks', data.tasks.length],
  ] as const

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Stored records" description="Everything currently held on this device" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-3">
            {counts.map(([label, value]) => (
              <div key={label} className="bg-surface-muted/70 rounded-lg px-3 py-2.5">
                <dt className="text-ink-muted text-[11px] font-medium">{label}</dt>
                <dd className="tabular text-ink text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Integrations"
            description="Not connected — every record in this app is entered by hand"
          />
          <CardBody className="space-y-3">
            <p className="text-ink-muted text-[13px]">
              The app talks to a single data repository rather than to storage directly, so a sensor feed,
              POS or supplier system can be added later by implementing that interface. Nothing in the
              screens above would need to change.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Wireless temperature probes', 'EPOS sales data', 'Supplier ordering', 'Payroll & rotas'].map(
                (label) => (
                  <span
                    key={label}
                    className="border-line-default text-ink-muted inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs"
                  >
                    <Plug className="size-3.5" />
                    {label}
                    <Badge tone="neutral">Planned</Badge>
                  </span>
                ),
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Demo data" description="Reset the sample records used to explore the app" />
          <CardBody className="space-y-3">
            <p className="text-ink-muted text-[13px]">
              Rebuilds two weeks of example temperature checks, deliveries and checklists relative to
              today. Anything you have entered yourself will be discarded.
            </p>
            <Button variant="danger" onClick={() => setConfirming(true)} className="gap-1.5">
              <RotateCcw className="size-4" />
              Reset demo data
            </Button>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Reset demo data?"
        description="This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetDemoData()
                setConfirming(false)
                toast.success('Demo data rebuilt', 'Two weeks of sample records have been regenerated.')
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-ink-muted flex items-start gap-2 text-[13px]">
          <Database className="text-ink-subtle mt-0.5 size-4 shrink-0" />
          All {data.temperatureLogs.length} temperature records, {data.deliveries.length} deliveries and{' '}
          {data.checklistRuns.length} checklist runs on this device will be replaced with a fresh demo set.
        </p>
      </Modal>
    </div>
  )
}
