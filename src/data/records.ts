/**
 * `AppData` as individual records.
 *
 * Sync stores and exchanges one record per entity, keyed by the `AppData` list
 * it lives in and its id, so devices merge entity by entity instead of
 * overwriting each other's whole dataset. These are the pure conversions both
 * ways; `supabaseRepository.ts` does the storage and network side.
 */
import type { AppData, ID, VenueSettings } from './types'

export type ListKey = Exclude<keyof AppData, 'settings'>
export type Collection = ListKey | 'settings'

/** The venue settings are one record under this id. */
export const SETTINGS_ID = 'venue'

/** One record on its way between devices. `data: null` means it was deleted. */
export interface RecordChange {
  collection: Collection
  id: ID
  data: object | null
  /** Position in an entry-ordered list (see `LISTS`); null everywhere else. */
  sort: number | null
}

/** Entry-order positions per list, so a new device shows lists in the same order. */
export type SortKeys = Partial<Record<ListKey, Map<ID, number>>>

interface Entity {
  id: ID
}

type Compare<K extends ListKey> = (a: AppData[K][number], b: AppData[K][number]) => number

/**
 * Every list on `AppData`, with how the store orders it. Lists with a
 * comparator are kept newest first by time; the rest stay in the order things
 * were entered (new at the top), which is carried between devices as a sort key.
 */
const LISTS: { [K in ListKey]: Compare<K> | null } = {
  staff: null,
  items: null,
  temperatureLogs: (a, b) => b.recordedAt.localeCompare(a.recordedAt),
  suppliers: null,
  deliveries: (a, b) => b.receivedAt.localeCompare(a.receivedAt),
  checklistTemplates: null,
  checklistRuns: (a, b) => b.completedAt.localeCompare(a.completedAt),
  issues: null,
  stock: null,
  tasks: null,
  taskTemplates: null,
}

export const LIST_KEYS = Object.keys(LISTS) as ListKey[]

export const EMPTY_DATA: AppData = {
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
  taskTemplates: [],
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

export function recordKey(record: { collection: string; id: ID }): string {
  return `${record.collection}/${record.id}`
}

function isListKey(value: string): value is ListKey {
  return Object.hasOwn(LISTS, value)
}

function comparatorFor(key: ListKey) {
  return LISTS[key] as ((a: Entity, b: Entity) => number) | null
}

function withList(data: AppData, key: ListKey, list: Entity[]): AppData {
  return { ...data, [key]: list } as AppData
}

/**
 * Deep equality for JSON-shaped values. A key holding `undefined` counts as
 * absent, and key order doesn't matter, so a record that has been through the
 * server (which drops the one and reorders the other) still matches its original.
 */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((value, index) => sameJson(value, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!sameJson(left[key], right[key])) return false
  }
  return true
}

/**
 * The changes that turn `prev` into `next`. Entries new to an entry-ordered
 * list are given sort keys in place in `sortKeys`, and removed ones dropped.
 * With no `prev`, everything in `next` is new.
 */
export function diffData(prev: AppData | null, next: AppData, sortKeys: SortKeys): RecordChange[] {
  const changes: RecordChange[] = []

  for (const key of LIST_KEYS) {
    const before: Entity[] = prev ? prev[key] : []
    const after: Entity[] = next[key]
    // Reducers only replace the lists they touch, so most saves skip most lists here.
    if (before === after) continue

    const keys = comparatorFor(key) ? null : assignSortKeys(after, (sortKeys[key] ??= new Map()))
    const previous = new Map(before.map((entity) => [entity.id, entity]))

    for (const entity of after) {
      const old = previous.get(entity.id)
      previous.delete(entity.id)
      if (old !== undefined && sameJson(old, entity)) continue
      changes.push({ collection: key, id: entity.id, data: entity, sort: keys?.get(entity.id) ?? null })
    }
    // Whatever is left was removed.
    for (const id of previous.keys()) {
      changes.push({ collection: key, id, data: null, sort: null })
      keys?.delete(id)
    }
  }

  if (!prev || !sameJson(prev.settings, next.settings)) {
    changes.push({ collection: 'settings', id: SETTINGS_ID, data: next.settings, sort: null })
  }
  return changes
}

/**
 * Gives every entry without a sort key one that keeps it where it sits in
 * `list`: new entries at the top get keys below the first known one, and a
 * list with none known yet is numbered from 0.
 */
function assignSortKeys(list: Entity[], keys: Map<ID, number>): Map<ID, number> {
  let run: ID[] = []
  let below: number | null = null

  const place = (above: number | null) => {
    run.forEach((id, index) => keys.set(id, between(below, above, index, run.length)))
    run = []
  }

  for (const entity of list) {
    const known = keys.get(entity.id)
    if (known === undefined) {
      run.push(entity.id)
      continue
    }
    if (run.length > 0) place(known)
    below = known
  }
  if (run.length > 0) place(null)
  return keys
}

/** The `index`-th of `count` evenly spaced keys between two known ones. */
function between(low: number | null, high: number | null, index: number, count: number): number {
  if (low === null && high === null) return index
  if (low === null) return (high as number) - (count - index)
  if (high === null) return low + index + 1
  return low + ((high - low) * (index + 1)) / (count + 1)
}

/**
 * Merges records from another device. Updates replace the entry where it
 * stands; new entries go to the top of entry-ordered lists in `sort` order,
 * where a local add would put them; time-ordered lists are re-sorted.
 */
export function applyChanges(data: AppData, changes: RecordChange[]): AppData {
  const grouped = new Map<Collection, RecordChange[]>()
  for (const change of changes) {
    const group = grouped.get(change.collection)
    if (group) group.push(change)
    else grouped.set(change.collection, [change])
  }

  let next = data
  for (const [collection, group] of grouped) {
    if (collection === 'settings') {
      const latest = group.at(-1)?.data
      if (latest) next = { ...next, settings: latest as VenueSettings }
      continue
    }
    // Written by a newer version of the app; nothing here knows how to show it.
    if (!isListKey(collection)) continue

    const incoming = new Map(group.map((change) => [change.id, change]))
    const current: Entity[] = next[collection]
    const kept = current.flatMap((entity) => {
      const change = incoming.get(entity.id)
      if (!change) return [entity]
      incoming.delete(entity.id)
      return change.data ? [change.data as Entity] : []
    })
    const added = [...incoming.values()]
      .filter((change) => change.data !== null)
      .sort(bySortKey)
      .map((change) => change.data as Entity)

    const compare = comparatorFor(collection)
    const list = [...added, ...kept]
    next = withList(next, collection, compare ? list.sort(compare) : list)
  }
  return next
}

function bySortKey(a: RecordChange, b: RecordChange): number {
  if (a.sort === b.sort) return 0
  if (a.sort === null) return 1
  if (b.sort === null) return -1
  return a.sort - b.sort
}

/** Keeps `sortKeys` in step with records merged by `applyChanges`. */
export function trackSortKeys(sortKeys: SortKeys, changes: RecordChange[]): void {
  for (const change of changes) {
    if (change.collection === 'settings' || !isListKey(change.collection)) continue
    if (comparatorFor(change.collection)) continue
    const keys = (sortKeys[change.collection] ??= new Map())
    if (change.data === null) keys.delete(change.id)
    else if (change.sort !== null) keys.set(change.id, change.sort)
  }
}

/**
 * Fills in lists added to `AppData` since `data` was stored, so a copy saved by
 * an older version of the app loads without losing anything already in it.
 */
export function withMissingLists(data: AppData): AppData {
  return { ...EMPTY_DATA, ...data }
}

/** A whole venue from its live records, as a new device first sees it. */
export function buildData(records: RecordChange[]): { data: AppData; sortKeys: SortKeys } {
  const sortKeys: SortKeys = {}
  trackSortKeys(sortKeys, records)
  return { data: applyChanges(EMPTY_DATA, records), sortKeys }
}

/** Whether `data` already reflects `change`, e.g. our own write coming back. */
export function holds(data: AppData, change: RecordChange): boolean {
  if (change.collection === 'settings') return change.data === null || sameJson(data.settings, change.data)
  if (!isListKey(change.collection)) return true
  const list: Entity[] = data[change.collection]
  const existing = list.find((entity) => entity.id === change.id)
  return change.data === null ? existing === undefined : existing !== undefined && sameJson(existing, change.data)
}
