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
import { deriveDeliveryStatus, evaluateTemperature } from '@/lib/compliance'
import { createId } from '@/lib/utils'
import type { DataRepository } from './repository'
import type {
  AppData,
  ChecklistRun,
  ChecklistTemplate,
  Delivery,
  FoodSafetyIssue,
  ID,
  MonitoredItem,
  StaffMember,
  StockItem,
  Supplier,
  Task,
  TemperatureLog,
  VenueSettings,
} from './types'

type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'temperature/add'; log: TemperatureLog }
  | { type: 'temperature/delete'; id: ID }
  | { type: 'delivery/add'; delivery: Delivery }
  | { type: 'delivery/update'; delivery: Delivery }
  | { type: 'delivery/delete'; id: ID }
  | { type: 'checklist/run'; run: ChecklistRun }
  | { type: 'checklist/template/save'; template: ChecklistTemplate }
  | { type: 'issue/add'; issue: FoodSafetyIssue }
  | { type: 'issue/update'; id: ID; changes: Partial<FoodSafetyIssue> }
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: ID; changes: Partial<Task> }
  | { type: 'task/delete'; id: ID }
  | { type: 'stock/update'; id: ID; changes: Partial<StockItem> }
  | { type: 'stock/add'; item: StockItem }
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
    case 'temperature/add':
      return {
        ...state,
        temperatureLogs: [action.log, ...state.temperatureLogs].sort((a, b) =>
          b.recordedAt.localeCompare(a.recordedAt),
        ),
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
    case 'task/update':
      return { ...state, tasks: patch(state.tasks, action.id, action.changes) }
    case 'task/delete':
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.id) }
    case 'stock/update':
      return { ...state, stock: patch(state.stock, action.id, action.changes) }
    case 'stock/add':
      return { ...state, stock: [action.item, ...state.stock] }
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
  /** Raise a tracked food-safety issue alongside a failed reading. */
  raiseIssue?: boolean
}

interface StoreValue {
  data: AppData
  ready: boolean
  /** Staff member currently signed in on this device. */
  activeStaffId: ID
  setActiveStaffId: (id: ID) => void
  activeStaff: StaffMember
  recordTemperature: (input: RecordTemperatureInput) => TemperatureLog
  deleteTemperature: (id: ID) => void
  saveDelivery: (delivery: Delivery, isNew: boolean) => void
  deleteDelivery: (id: ID) => void
  recordChecklistRun: (run: ChecklistRun) => void
  saveChecklistTemplate: (template: ChecklistTemplate) => void
  addIssue: (issue: Omit<FoodSafetyIssue, 'id'>) => FoodSafetyIssue
  updateIssue: (id: ID, changes: Partial<FoodSafetyIssue>) => void
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: ID, changes: Partial<Task>) => void
  deleteTask: (id: ID) => void
  updateStock: (id: ID, changes: Partial<StockItem>) => void
  addStockItem: (item: Omit<StockItem, 'id'>) => void
  saveItem: (item: MonitoredItem) => void
  deleteItem: (id: ID) => void
  saveStaff: (member: StaffMember) => void
  saveSupplier: (supplier: Supplier) => void
  updateSettings: (changes: Partial<VenueSettings>) => void
  resetDemoData: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const EMPTY_DATA: AppData = {
  staff: [],
  items: [],
  temperatureLogs: [],
  suppliers: [],
  deliveries: [],
  checklistTemplates: [],
  checklistRuns: [],
  issues: [],
  stock: [],
  tasks: [],
  settings: {
    venueName: '',
    siteReference: '',
    address: '',
    temperatureUnit: 'C',
    periods: [],
    chilledDeliveryMaxTemp: 8,
    frozenDeliveryMaxTemp: -15,
  },
}

const ACTIVE_STAFF_KEY = 'mise.activeStaff'

export function StoreProvider({
  repository,
  children,
}: {
  repository: DataRepository
  children: ReactNode
}) {
  const [data, dispatch] = useReducer(reducer, EMPTY_DATA)
  const [ready, setReady] = useState(false)
  const [activeStaffId, setActiveStaffIdState] = useState<ID>('')
  const hydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    repository.load().then((loaded) => {
      if (cancelled) return
      dispatch({ type: 'hydrate', data: loaded })
      const stored = localStorage.getItem(ACTIVE_STAFF_KEY)
      const valid = loaded.staff.find((person) => person.id === stored && person.active)
      setActiveStaffIdState(valid?.id ?? loaded.staff.find((person) => person.active)?.id ?? '')
      hydrated.current = true
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [repository])

  // Persist after hydration only, so the initial empty state never overwrites.
  useEffect(() => {
    if (!hydrated.current) return
    repository.save(data)
  }, [data, repository])

  const setActiveStaffId = useCallback((id: ID) => {
    setActiveStaffIdState(id)
    localStorage.setItem(ACTIVE_STAFF_KEY, id)
  }, [])

  const value = useMemo<StoreValue>(() => {
    const activeStaff =
      data.staff.find((person) => person.id === activeStaffId) ??
      data.staff[0] ?? { id: '', name: 'Unassigned', role: 'chef', initials: '—', active: true }

    return {
      data,
      ready,
      activeStaffId,
      setActiveStaffId,
      activeStaff,

      recordTemperature(input) {
        const item = data.items.find((entry) => entry.id === input.itemId)
        const outcome = item ? evaluateTemperature(item, input.temperature) : 'pass'
        const log: TemperatureLog = {
          id: createId('tl'),
          itemId: input.itemId,
          temperature: input.temperature,
          recordedAt: input.recordedAt,
          recordedBy: input.recordedBy,
          outcome,
          period: input.period,
          correctiveAction: input.correctiveAction,
          notes: input.notes,
        }
        dispatch({ type: 'temperature/add', log })

        if (outcome === 'fail' && input.raiseIssue !== false && item) {
          dispatch({
            type: 'issue/add',
            issue: {
              id: createId('is'),
              title: `${item.name} out of range at ${input.temperature}°C`,
              description:
                input.correctiveAction ??
                'Reading outside the safe range. Corrective action required.',
              severity: item.category === 'cooking' || item.category === 'hot_holding' ? 'high' : 'medium',
              status: 'open',
              source: 'temperature',
              raisedAt: input.recordedAt,
              raisedBy: input.recordedBy,
              linkedRecordId: log.id,
            },
          })
        }
        return log
      },

      deleteTemperature(id) {
        dispatch({ type: 'temperature/delete', id })
      },

      saveDelivery(delivery, isNew) {
        const normalised: Delivery = { ...delivery, status: deriveDeliveryStatus(delivery.lines) }
        dispatch(isNew ? { type: 'delivery/add', delivery: normalised } : { type: 'delivery/update', delivery: normalised })

        if (isNew && normalised.status !== 'accepted') {
          const supplier = data.suppliers.find((entry) => entry.id === normalised.supplierId)
          const rejected = normalised.lines.filter((line) => !line.accepted)
          dispatch({
            type: 'issue/add',
            issue: {
              id: createId('is'),
              title: `${rejected.length} line${rejected.length === 1 ? '' : 's'} rejected from ${supplier?.name ?? 'supplier'}`,
              description: rejected
                .map((line) => `${line.product}: ${line.rejectionReason ?? 'Rejected on receipt.'}`)
                .join('\n'),
              severity: normalised.status === 'rejected' ? 'high' : 'medium',
              status: 'open',
              source: 'delivery',
              raisedAt: normalised.receivedAt,
              raisedBy: normalised.checkedBy,
              linkedRecordId: normalised.id,
            },
          })
        }
      },

      deleteDelivery(id) {
        dispatch({ type: 'delivery/delete', id })
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

      updateStock(id, changes) {
        dispatch({ type: 'stock/update', id, changes })
      },

      addStockItem(item) {
        dispatch({ type: 'stock/add', item: { ...item, id: createId('sk') } })
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
        const fresh = await repository.reset()
        dispatch({ type: 'hydrate', data: fresh })
      },
    }
  }, [data, ready, activeStaffId, setActiveStaffId, repository])

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
