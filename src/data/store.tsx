/**
 * Application store.
 *
 * A single reducer over `AppData`, exposed through context. Writes are mirrored
 * to the repository so a refresh keeps whatever staff entered. Mutations are
 * expressed as intent-shaped actions ("record a temperature") rather than
 * generic setters, which keeps the compliance side-effects in one place.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { deriveDeliveryStatus, evaluateTemperature, periodForTime } from '@/lib/compliance'
import { createId, initialsOf } from '@/lib/utils'
import { applyChanges, EMPTY_DATA, type RecordChange } from './records'
import type { DataRepository } from './repository'
import { staffRoleFromText } from './staffRoles'
import type {
  AppData,
  ChecklistRun,
  ChecklistTemplate,
  Delivery,
  FoodSafetyIssue,
  ID,
  ISODate,
  MonitoredItem,
  StaffMember,
  StockItem,
  Supplier,
  SupplierOrder,
  SupplierOrderLine,
  Task,
  TaskTemplate,
  TemperatureLog,
  TemperatureLogFields,
  VenueSettings,
} from './types'

type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'remote/apply'; changes: RecordChange[] }
  | { type: 'temperature/add'; log: TemperatureLog }
  | { type: 'temperature/update'; log: TemperatureLog }
  | { type: 'temperature/delete'; id: ID }
  | { type: 'delivery/add'; delivery: Delivery }
  | { type: 'delivery/update'; delivery: Delivery }
  | { type: 'delivery/delete'; id: ID }
  | { type: 'order/save'; order: SupplierOrder }
  | { type: 'checklist/run'; run: ChecklistRun }
  | { type: 'checklist/template/save'; template: ChecklistTemplate }
  | { type: 'issue/add'; issue: FoodSafetyIssue }
  | { type: 'issue/update'; id: ID; changes: Partial<FoodSafetyIssue> }
  | { type: 'task/add'; task: Task }
  | { type: 'task/addMany'; tasks: Task[] }
  | { type: 'task/update'; id: ID; changes: Partial<Task> }
  | { type: 'task/delete'; id: ID }
  | { type: 'template/save'; template: TaskTemplate }
  | { type: 'template/addMany'; templates: TaskTemplate[] }
  | { type: 'template/delete'; id: ID }
  | { type: 'stock/update'; id: ID; changes: Partial<StockItem> }
  | { type: 'stock/add'; item: StockItem }
  | { type: 'stock/delete'; id: ID }
  | { type: 'item/save'; item: MonitoredItem }
  | { type: 'item/delete'; id: ID }
  | { type: 'staff/save'; member: StaffMember }
  | { type: 'supplier/save'; supplier: Supplier }
  | { type: 'settings/update'; changes: Partial<VenueSettings> }

function upsert<T extends { id: ID }>(list: T[], entity: T): T[] {
  const index = list.findIndex((existing) => existing.id === entity.id)
  if (index === -1) return [entity, ...list]
  const next = [...list]
  next[index] = entity
  return next
}

function patch<T extends { id: ID }>(list: T[], id: ID, changes: Partial<T>): T[] {
  return list.map((entity) => (entity.id === id ? { ...entity, ...changes } : entity))
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'hydrate':
      return action.data
    case 'remote/apply':
      return applyChanges(state, action.changes)
    case 'temperature/add':
      return {
        ...state,
        temperatureLogs: [action.log, ...state.temperatureLogs].sort((a, b) =>
          b.recordedAt.localeCompare(a.recordedAt),
        ),
      }
    case 'temperature/update':
      return {
        ...state,
        temperatureLogs: state.temperatureLogs
          .map((log) => (log.id === action.log.id ? action.log : log))
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
      }
    case 'temperature/delete':
      return { ...state, temperatureLogs: state.temperatureLogs.filter((log) => log.id !== action.id) }
    case 'delivery/add':
      return {
        ...state,
        deliveries: [action.delivery, ...state.deliveries].sort((a, b) =>
          b.receivedAt.localeCompare(a.receivedAt),
        ),
      }
    case 'delivery/update':
      return { ...state, deliveries: upsert(state.deliveries, action.delivery) }
    case 'delivery/delete':
      return { ...state, deliveries: state.deliveries.filter((delivery) => delivery.id !== action.id) }
    case 'order/save':
      return { ...state, supplierOrders: upsert(state.supplierOrders, action.order) }
    case 'checklist/run':
      return {
        ...state,
        checklistRuns: [action.run, ...state.checklistRuns].sort((a, b) =>
          b.completedAt.localeCompare(a.completedAt),
        ),
      }
    case 'checklist/template/save':
      return { ...state, checklistTemplates: upsert(state.checklistTemplates, action.template) }
    case 'issue/add':
      return { ...state, issues: [action.issue, ...state.issues] }
    case 'issue/update':
      return { ...state, issues: patch(state.issues, action.id, action.changes) }
    case 'task/add':
      return { ...state, tasks: [action.task, ...state.tasks] }
    case 'task/addMany':
      return { ...state, tasks: [...action.tasks, ...state.tasks] }
    case 'task/update':
      return { ...state, tasks: patch(state.tasks, action.id, action.changes) }
    case 'task/delete':
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.id) }
    case 'template/save':
      return { ...state, taskTemplates: upsert(state.taskTemplates, action.template) }
    case 'template/addMany':
      return { ...state, taskTemplates: [...state.taskTemplates, ...action.templates] }
    case 'template/delete':
      return { ...state, taskTemplates: state.taskTemplates.filter((template) => template.id !== action.id) }
    case 'stock/update':
      return { ...state, stock: patch(state.stock, action.id, action.changes) }
    case 'stock/add':
      return { ...state, stock: [action.item, ...state.stock] }
    case 'stock/delete':
      return { ...state, stock: state.stock.filter((item) => item.id !== action.id) }
    case 'item/save':
      return { ...state, items: upsert(state.items, action.item) }
    case 'item/delete':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) }
    case 'staff/save':
      return { ...state, staff: upsert(state.staff, action.member) }
    case 'supplier/save':
      return { ...state, suppliers: upsert(state.suppliers, action.supplier) }
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.changes } }
    default:
      return state
  }
}

export interface RecordTemperatureInput {
  itemId: ID
  temperature: number
  recordedAt: string
  recordedBy: ID
  period?: TemperatureLog['period']
  correctiveAction?: string
  notes?: string
  /** Proof of the reading: a photo of the probe or display showing it. */
  photo: Blob
  /** Raise a tracked food-safety issue alongside a failed reading. */
  raiseIssue?: boolean
}

export interface EditTemperatureInput {
  temperature: number
  recordedAt: string
  recordedBy: ID
  correctiveAction?: string
  notes?: string
  /** A new photo, replacing the old one. The old one stays in the reading's history. */
  photo?: Blob
  /** Why it changed, for whoever looks back at it. */
  reason?: string
}

export interface CheckInInput {
  orderId: ID
  /** What arrived, as checked. Its order, status and supplier are filled in from the order. */
  delivery: Delivery
  /** Extras moved onto the order list: added to the order, so they count toward its prices. */
  addToOrder: SupplierOrderLine[]
}

interface StoreValue {
  data: AppData
  ready: boolean
  /** False on a first run, until the venue is set up or demo data is loaded. */
  hasData: boolean
  /** Staff member currently signed in on this device: in a synced team, always the signed-in person. */
  activeStaffId: ID
  /** Device-only use: who's holding the device. A synced team ignores it. */
  setActiveStaffId: (id: ID) => void
  activeStaff: StaffMember
  recordTemperature: (input: RecordTemperatureInput) => TemperatureLog
  /** Changes a saved reading, keeping what it said before. Who may is up to the screens (and the server). */
  editTemperature: (id: ID, changes: EditTemperatureInput) => void
  deleteTemperature: (id: ID) => void
  /** A record's photo as an object URL to revoke when done, or null when it can't be shown. */
  photoUrl: (path: string) => Promise<string | null>
  /** `newSupplier` is one typed in on the delivery form, added alongside the delivery. */
  saveDelivery: (delivery: Delivery, isNew: boolean, newSupplier?: Supplier) => void
  deleteDelivery: (id: ID) => void
  /** Adds or changes an open order: items, quantities, prices, dates. Received and cancelled orders stay as they are. */
  saveOrder: (order: SupplierOrder) => void
  /** A new delivery date for an order, which makes an overdue one expected again. */
  moveOrderDelivery: (id: ID, deliveryDate: ISODate) => void
  /** Calls an order off. It stays in the supplier's history. */
  cancelOrder: (id: ID) => void
  /** Records the delivery an order arrived as, and marks the order received by whoever checked it in. */
  checkInOrder: (input: CheckInInput) => Delivery
  recordChecklistRun: (run: ChecklistRun) => void
  saveChecklistTemplate: (template: ChecklistTemplate) => void
  addIssue: (issue: Omit<FoodSafetyIssue, 'id'>) => FoodSafetyIssue
  updateIssue: (id: ID, changes: Partial<FoodSafetyIssue>) => void
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: ID, changes: Partial<Task>) => void
  deleteTask: (id: ID) => void
  /** Adds several tasks at once, e.g. a template's tasks to someone's list. */
  addTasks: (tasks: Omit<Task, 'id' | 'createdAt'>[]) => void
  saveTaskTemplate: (template: TaskTemplate) => void
  /** Appends templates after the ones already there, e.g. the starter library. */
  addTaskTemplates: (templates: TaskTemplate[]) => void
  deleteTaskTemplate: (id: ID) => void
  updateStock: (id: ID, changes: Partial<StockItem>) => void
  addStockItem: (item: Omit<StockItem, 'id'>) => void
  deleteStockItem: (id: ID) => void
  saveItem: (item: MonitoredItem) => void
  deleteItem: (id: ID) => void
  saveStaff: (member: StaffMember) => void
  saveSupplier: (supplier: Supplier) => void
  updateSettings: (changes: Partial<VenueSettings>) => void
  resetDemoData: () => Promise<void>
  /** Replaces everything on this device, e.g. with a venue built from a setup pack. */
  replaceData: (data: AppData) => void
}

const StoreContext = createContext<StoreValue | null>(null)

/** Whoever is signed in to a synced team. Each person has their own record in the team's staff list. */
export interface SignedInPerson {
  userId: string
  /** From their profile; the team screens make sure there is one. */
  name: string
  /** The role they asked to join with, for their first staff record. Absent for whoever created the team. */
  jobRole?: string
}

/** The same on every device, so two of someone's devices never add them twice. */
function staffIdFor(userId: string): ID {
  return `st_${userId}`
}

/**
 * Setting a synced venue up again replaces its records, but everyone keeps
 * their place in the team. Whoever ran setup is the setup's manager.
 */
function keepAccounts(next: AppData, current: StaffMember[], person: SignedInPerson): AppData {
  const mine = current.find((member) => member.userId === person.userId)
  const others = current.filter((member) => member.userId && member.userId !== person.userId)
  const [manager, ...rest] = next.staff
  const me = manager ? [{ ...manager, id: mine?.id ?? staffIdFor(person.userId), userId: person.userId }] : []
  return { ...next, staff: [...me, ...rest, ...others] }
}

const ACTIVE_STAFF_KEY = 'mise.activeStaff'

export function StoreProvider({
  repository,
  person,
  children,
}: {
  repository: DataRepository
  /** Set when the team syncs: the app then acts as this person rather than asking who's using the device. */
  person?: SignedInPerson
  children: ReactNode
}) {
  const [data, dispatch] = useReducer(reducer, EMPTY_DATA)
  const [ready, setReady] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [activeStaffId, setActiveStaffIdState] = useState<ID>('')

  /** Swaps in a whole dataset, keeping this device's signed-in person if they still exist. */
  const applyData = useCallback((next: AppData) => {
    dispatch({ type: 'hydrate', data: next })
    const stored = localStorage.getItem(ACTIVE_STAFF_KEY)
    const valid = next.staff.find((person) => person.id === stored && person.active)
    setActiveStaffIdState(valid?.id ?? next.staff.find((person) => person.active)?.id ?? '')
    setHasData(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    repository.load().then((loaded) => {
      if (cancelled) return
      if (loaded) applyData(loaded)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [repository, applyData])

  // Records from the venue's other devices, merged over whatever is on screen.
  useEffect(
    () => repository.subscribe?.((changes) => dispatch({ type: 'remote/apply', changes })),
    [repository],
  )

  // Persist only once there is a real dataset, so the empty placeholder shown
  // during a first run never gets saved and mistaken for a set-up venue.
  useEffect(() => {
    if (!hasData) return
    repository.save(data)
  }, [data, hasData, repository])

  // A synced team's staff list has a record for everyone who signs in. Someone
  // in it from before accounts (same name, no account yet) takes that record
  // over, so their past entries stay theirs; anyone else is added.
  const userId = person?.userId
  const personName = person?.name.trim() ?? ''
  const jobRole = person?.jobRole
  const lastName = useRef(personName)
  useEffect(() => {
    if (!userId || !hasData || !personName) return
    const linked = data.staff.find((member) => member.userId === userId)
    const renamed = personName !== lastName.current
    lastName.current = personName
    if (linked) {
      // A name changed on their profile carries over to the team's list.
      if (renamed && linked.name !== personName) {
        dispatch({ type: 'staff/save', member: { ...linked, name: personName, initials: initialsOf(personName) } })
      }
      return
    }
    const key = personName.toLowerCase()
    const unclaimed = data.staff.find((member) => !member.userId && member.name.trim().toLowerCase() === key)
    dispatch({
      type: 'staff/save',
      member: unclaimed
        ? { ...unclaimed, userId, active: true }
        : {
            id: staffIdFor(userId),
            userId,
            name: personName,
            ...staffRoleFromText(jobRole),
            initials: initialsOf(personName),
            active: true,
          },
    })
  }, [userId, personName, jobRole, hasData, data.staff])

  const setActiveStaffId = useCallback((id: ID) => {
    setActiveStaffIdState(id)
    localStorage.setItem(ACTIVE_STAFF_KEY, id)
  }, [])

  // Its own function, so showing a photo doesn't fetch it again every time the data changes.
  const photoUrl = useCallback((path: string) => repository.photoUrl(path), [repository])

  const value = useMemo<StoreValue>(() => {
    const activeStaff: StaffMember = userId
      ? (data.staff.find((member) => member.userId === userId) ?? {
          // Only until the effect above has added them.
          id: staffIdFor(userId),
          userId,
          name: personName || 'You',
          role: 'chef',
          initials: initialsOf(personName) || '—',
          active: true,
        })
      : (data.staff.find((member) => member.id === activeStaffId) ??
        data.staff[0] ?? { id: '', name: 'Unassigned', role: 'chef', initials: '—', active: true })

    /** An out-of-range reading becomes an issue, so it gets followed up. */
    function raiseReadingIssue(item: MonitoredItem, log: TemperatureLog) {
      dispatch({
        type: 'issue/add',
        issue: {
          id: createId('is'),
          title: `${item.name} out of range at ${log.temperature}°C`,
          description: log.correctiveAction ?? 'Reading outside the safe range. Corrective action required.',
          severity: item.category === 'cooking' || item.category === 'hot_holding' ? 'high' : 'medium',
          status: 'open',
          source: 'temperature',
          raisedAt: log.recordedAt,
          raisedBy: log.recordedBy,
          linkedRecordId: log.id,
        },
      })
    }

    /** Rejected lines on a new delivery become an issue, so they get followed up. */
    function raiseRejectionIssue(delivery: Delivery, newSupplier?: Supplier) {
      if (delivery.status === 'accepted') return
      const supplier = newSupplier ?? data.suppliers.find((entry) => entry.id === delivery.supplierId)
      const rejected = delivery.lines.filter((line) => !line.accepted)
      dispatch({
        type: 'issue/add',
        issue: {
          id: createId('is'),
          title: `${rejected.length} line${rejected.length === 1 ? '' : 's'} rejected from ${supplier?.name ?? 'supplier'}`,
          description: rejected
            .map((line) => `${line.product}: ${line.rejectionReason ?? 'Rejected on receipt.'}`)
            .join('\n'),
          severity: delivery.status === 'rejected' ? 'high' : 'medium',
          status: 'open',
          source: 'delivery',
          raisedAt: delivery.receivedAt,
          raisedBy: delivery.checkedBy,
          linkedRecordId: delivery.id,
        },
      })
    }

    return {
      data,
      ready,
      hasData,
      activeStaffId: activeStaff.id,
      setActiveStaffId,
      activeStaff,

      recordTemperature(input) {
        const item = data.items.find((entry) => entry.id === input.itemId)
        const outcome = item ? evaluateTemperature(item, input.temperature) : 'pass'
        const id = createId('tl')
        const log: TemperatureLog = {
          id,
          itemId: input.itemId,
          temperature: input.temperature,
          recordedAt: input.recordedAt,
          recordedBy: input.recordedBy,
          outcome,
          period: input.period,
          correctiveAction: input.correctiveAction,
          notes: input.notes,
          enteredAt: new Date().toISOString(),
          enteredBy: activeStaff.id,
          photo: repository.addPhoto(id, input.photo),
        }
        dispatch({ type: 'temperature/add', log })
        if (outcome === 'fail' && input.raiseIssue !== false && item) raiseReadingIssue(item, log)
        return log
      },

      editTemperature(id, input) {
        const log = data.temperatureLogs.find((entry) => entry.id === id)
        if (!log) return
        const item = data.items.find((entry) => entry.id === log.itemId)
        const outcome = item ? evaluateTemperature(item, input.temperature) : log.outcome
        const before: TemperatureLogFields = {
          temperature: log.temperature,
          outcome: log.outcome,
          recordedAt: log.recordedAt,
          recordedBy: log.recordedBy,
          correctiveAction: log.correctiveAction,
          notes: log.notes,
          photo: log.photo,
        }
        const next: TemperatureLog = {
          ...log,
          temperature: input.temperature,
          outcome,
          recordedAt: input.recordedAt,
          recordedBy: input.recordedBy,
          // A new time can put it in a different check.
          period:
            input.recordedAt !== log.recordedAt && item && item.requiredChecks.length > 0
              ? periodForTime(data.settings.periods, new Date(input.recordedAt))
              : log.period,
          correctiveAction: input.correctiveAction,
          notes: input.notes,
          photo: input.photo ? repository.addPhoto(id, input.photo) : log.photo,
          edits: [
            ...(log.edits ?? []),
            { at: new Date().toISOString(), by: activeStaff.id, reason: input.reason, before },
          ],
        }
        dispatch({ type: 'temperature/update', log: next })
        // Out of range now when it wasn't before: it needs following up like any other.
        if (outcome === 'fail' && log.outcome !== 'fail' && item) raiseReadingIssue(item, next)
      },

      photoUrl,

      deleteTemperature(id) {
        dispatch({ type: 'temperature/delete', id })
      },

      saveDelivery(delivery, isNew, newSupplier) {
        const normalised: Delivery = { ...delivery, status: deriveDeliveryStatus(delivery.lines) }
        if (newSupplier) dispatch({ type: 'supplier/save', supplier: newSupplier })
        dispatch(isNew ? { type: 'delivery/add', delivery: normalised } : { type: 'delivery/update', delivery: normalised })
        if (isNew) raiseRejectionIssue(normalised, newSupplier)
      },

      deleteDelivery(id) {
        dispatch({ type: 'delivery/delete', id })
      },

      saveOrder(order) {
        const current = data.supplierOrders.find((entry) => entry.id === order.id)
        if (current && current.status !== 'open') return
        dispatch({ type: 'order/save', order })
      },

      moveOrderDelivery(id, deliveryDate) {
        const order = data.supplierOrders.find((entry) => entry.id === id)
        if (!order || order.status !== 'open') return
        // An order-by date after the new delivery date would make no sense.
        const orderBy = order.orderBy && order.orderBy > deliveryDate ? undefined : order.orderBy
        dispatch({ type: 'order/save', order: { ...order, deliveryDate, orderBy } })
      },

      cancelOrder(id) {
        const order = data.supplierOrders.find((entry) => entry.id === id)
        if (!order || order.status !== 'open') return
        dispatch({
          type: 'order/save',
          order: { ...order, status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: activeStaff.id },
        })
      },

      checkInOrder({ orderId, delivery, addToOrder }) {
        const order = data.supplierOrders.find((entry) => entry.id === orderId)
        const recorded: Delivery = {
          ...delivery,
          supplierId: order?.supplierId ?? delivery.supplierId,
          orderId,
          status: deriveDeliveryStatus(delivery.lines),
        }
        dispatch({ type: 'delivery/add', delivery: recorded })
        raiseRejectionIssue(recorded)
        // Already checked in or called off on another device: the delivery is still recorded.
        if (order && order.status === 'open') {
          dispatch({
            type: 'order/save',
            order: {
              ...order,
              status: 'received',
              lines: [...order.lines, ...addToOrder],
              receivedAt: recorded.receivedAt,
              receivedBy: recorded.checkedBy,
              deliveryId: recorded.id,
            },
          })
        }
        return recorded
      },

      recordChecklistRun(run) {
        dispatch({ type: 'checklist/run', run })
        const template = data.checklistTemplates.find((entry) => entry.id === run.templateId)
        if (!template) return
        const failedCritical = run.results.filter(
          (result) =>
            result.status === 'fail' && template.items.find((item) => item.id === result.itemId)?.critical,
        )
        for (const failure of failedCritical) {
          const definition = template.items.find((item) => item.id === failure.itemId)
          dispatch({
            type: 'issue/add',
            issue: {
              id: createId('is'),
              title: `${template.name}: ${definition?.label ?? 'critical check'} failed`,
              description: failure.note ?? 'Critical checklist item failed — needs follow-up.',
              severity: 'high',
              status: 'open',
              source: 'checklist',
              raisedAt: run.completedAt,
              raisedBy: run.completedBy,
              linkedRecordId: run.id,
            },
          })
        }
      },

      saveChecklistTemplate(template) {
        dispatch({ type: 'checklist/template/save', template })
      },

      addIssue(issue) {
        const created: FoodSafetyIssue = { ...issue, id: createId('is') }
        dispatch({ type: 'issue/add', issue: created })
        return created
      },

      updateIssue(id, changes) {
        dispatch({ type: 'issue/update', id, changes })
      },

      addTask(task) {
        dispatch({ type: 'task/add', task: { ...task, id: createId('tk'), createdAt: new Date().toISOString() } })
      },

      updateTask(id, changes) {
        dispatch({ type: 'task/update', id, changes })
      },

      deleteTask(id) {
        dispatch({ type: 'task/delete', id })
      },

      addTasks(tasks) {
        const createdAt = new Date().toISOString()
        dispatch({ type: 'task/addMany', tasks: tasks.map((task) => ({ ...task, id: createId('tk'), createdAt })) })
      },

      saveTaskTemplate(template) {
        dispatch({ type: 'template/save', template })
      },

      addTaskTemplates(templates) {
        dispatch({ type: 'template/addMany', templates })
      },

      deleteTaskTemplate(id) {
        dispatch({ type: 'template/delete', id })
      },

      updateStock(id, changes) {
        dispatch({ type: 'stock/update', id, changes })
      },

      addStockItem(item) {
        dispatch({ type: 'stock/add', item: { ...item, id: createId('sk') } })
      },

      deleteStockItem(id) {
        dispatch({ type: 'stock/delete', id })
      },

      saveItem(item) {
        dispatch({ type: 'item/save', item })
      },

      deleteItem(id) {
        dispatch({ type: 'item/delete', id })
      },

      saveStaff(member) {
        dispatch({ type: 'staff/save', member })
      },

      saveSupplier(supplier) {
        dispatch({ type: 'supplier/save', supplier })
      },

      updateSettings(changes) {
        dispatch({ type: 'settings/update', changes })
      },

      async resetDemoData() {
        applyData(await repository.reset())
      },

      replaceData(next) {
        applyData(userId ? keepAccounts(next, data.staff, { userId, name: personName }) : next)
      },
    }
  }, [data, ready, hasData, activeStaffId, setActiveStaffId, repository, applyData, userId, personName, photoUrl])

  return <StoreContext value={value}>{children}</StoreContext>
}

export function useStore(): StoreValue {
  const context = use(StoreContext)
  if (!context) throw new Error('useStore must be used inside a <StoreProvider>')
  return context
}

/** Convenience accessor for the raw dataset. */
export function useData(): AppData {
  return useStore().data
}
