/**
 * Offline-first repository backed by Supabase.
 *
 * Staff never wait on the network. Every save lands in IndexedDB first, so
 * recording works with no signal at all; each save is diffed into per-record
 * changes and queued in an outbox, which is pushed whenever the device is
 * online and signed in. Changes from the venue's other devices are pulled — on
 * a Realtime nudge, on reconnecting, on coming back to the tab and on a slow
 * poll — and handed to the store through `subscribe`.
 *
 * Conflicts resolve per record, last write wins. Most records are only ever
 * added (readings, deliveries, checklist runs), so two devices only really
 * contend when they edit the same task, issue or setting at the same time.
 */
import { isAuthRetryableFetchError, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { createStore, del, delMany, entries, get, set, setMany, type UseStore } from 'idb-keyval'
import {
  applyChanges,
  buildData,
  diffData,
  EMPTY_DATA,
  holds,
  recordKey,
  trackSortKeys,
  withMissingLists,
  type Collection,
  type RecordChange,
  type SortKeys,
} from './records'
import type { DataRepository, RemoteListener } from './repository'
import { createSeedData } from './seed'
import type { AppData } from './types'

export type SyncState = 'synced' | 'syncing' | 'offline' | 'signed-out' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Changes made on this device that haven't reached the server yet. */
  pending: number
  lastSyncedAt: string | null
  /** What went wrong, while `state` is `error`. */
  error: string | null
}

/** A row of `public.records`; see `supabase/migrations`. */
interface RecordRow {
  collection: Collection
  id: string
  data: object | null
  deleted: boolean
  sort: number | null
  updated_at: string
}

interface CachedVenue {
  version: number
  data: AppData | null
  sortKeys: SortKeys
  /** `updated_at` of the newest record seen from the server. */
  cursor: string | null
  lastSyncedAt: string | null
}

interface Pending extends RecordChange {
  /** Bumped on every local edit, so an upload only clears the version it sent. */
  seq: number
}

const TABLE = 'records'
const COLUMNS = 'collection,id,data,deleted,sort,updated_at'
/** Bump when `AppData` changes shape, so devices rebuild their cache from the server. */
const CACHE_VERSION = 1
/** Rows asked for per request; PostgREST caps it at 1000 unless the project changes that. */
const PAGE_SIZE = 1000
const PUSH_BATCH = 500
/** Re-read a little behind the cursor, so a write that committed late isn't skipped. */
const PULL_OVERLAP_MS = 60_000
/** Lets a round of readings go up together rather than one request each. */
const PUSH_DELAY_MS = 800
const POLL_MS = 60_000
/** How often a device's first load retries while it waits for a connection. */
const RETRY_MS = 10_000

// Two databases: each venue as last seen, and every unsent change under its own
// key, so two tabs queueing changes offline can't overwrite each other's.
let stores: { cache: UseStore; outbox: UseStore } | null = null
function idb() {
  stores ??= { cache: createStore('mise-cache', 'venues'), outbox: createStore('mise-outbox', 'changes') }
  return stores
}

let channels = 0

export class SupabaseRepository implements DataRepository {
  readonly venueId: string
  private readonly client: SupabaseClient
  /** Where this device kept records before sync; adopted by a venue that has none yet. */
  private readonly legacy: DataRepository | null

  /** The data as last saved or merged: what the next save is diffed against. */
  private snapshot: AppData | null = null
  private sortKeys: SortKeys = {}
  private cursor: string | null = null
  private readonly outbox = new Map<string, Pending>()
  private seq = 0

  private loading: Promise<AppData | null> | null = null
  private loaded = false
  private active = false
  private syncing = false
  private again = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private poll: ReturnType<typeof setInterval> | undefined
  private channel: RealtimeChannel | null = null
  private unsubscribeAuth: (() => void) | null = null
  private wake: (() => void) | null = null
  private writes: Promise<void> = Promise.resolve()

  private status: SyncStatus = { state: 'syncing', pending: 0, lastSyncedAt: null, error: null }
  private readonly statusListeners = new Set<() => void>()
  private readonly remoteListeners = new Set<RemoteListener>()

  constructor(client: SupabaseClient, venueId: string, legacy: DataRepository | null = null) {
    this.client = client
    this.venueId = venueId
    this.legacy = legacy
  }

  /* DataRepository ------------------------------------------------------- */

  load(): Promise<AppData | null> {
    // StrictMode mounts twice in development; both mounts share one load.
    this.loading ??= this.restore()
    return this.loading
  }

  async save(data: AppData): Promise<void> {
    const changes = diffData(this.snapshot, data, this.sortKeys)
    this.snapshot = data
    if (changes.length === 0) return

    for (const change of changes) this.outbox.set(recordKey(change), { ...change, seq: ++this.seq })
    this.setStatus({})
    // Outbox before cache: a change in the cache but not the outbox would never go up.
    await this.persist(async () => {
      await setMany(
        changes.map((change) => [this.outboxKey(change), change]),
        idb().outbox,
      )
      await this.writeCache()
    })
    // A new venue's first save (setup, demo data or adopted local records) is what starts it syncing.
    if (!this.loaded) this.ready()
    else this.requestSync(PUSH_DELAY_MS)
  }

  async reset(): Promise<AppData> {
    const data = createSeedData(new Date())
    await this.save(data)
    return data
  }

  subscribe(listener: RemoteListener): () => void {
    this.remoteListeners.add(listener)
    return () => this.remoteListeners.delete(listener)
  }

  /* Status, for the UI --------------------------------------------------- */

  readonly getStatus = (): SyncStatus => this.status

  readonly subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  syncNow(): void {
    this.nudge()
  }

  /* Lifecycle ------------------------------------------------------------ */

  /** Starts watching for chances to sync. Paired with `stop`; safe to repeat. */
  start(): void {
    if (this.active) return
    this.active = true
    window.addEventListener('online', this.nudge)
    window.addEventListener('offline', this.wentOffline)
    document.addEventListener('visibilitychange', this.cameBack)
    this.poll = setInterval(this.nudge, POLL_MS)

    const { data } = this.client.auth.onAuthStateChange((event) => {
      // Deferred: calling back into auth from inside its own callback can deadlock.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setTimeout(this.nudge)
      else if (event === 'SIGNED_OUT') setTimeout(() => this.setStatus({ state: 'signed-out' }))
    })
    this.unsubscribeAuth = () => data.subscription.unsubscribe()

    // Realtime is only a doorbell: any change to the venue triggers a pull, and
    // so does (re)connecting, to catch up on whatever happened meanwhile.
    this.channel = this.client
      .channel(`records:${this.venueId}:${++channels}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `venue_id=eq.${this.venueId}` },
        () => this.requestSync(PUSH_DELAY_MS),
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') this.requestSync()
      })

    this.requestSync()
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    window.removeEventListener('online', this.nudge)
    window.removeEventListener('offline', this.wentOffline)
    document.removeEventListener('visibilitychange', this.cameBack)
    clearInterval(this.poll)
    clearTimeout(this.timer)
    this.unsubscribeAuth?.()
    this.unsubscribeAuth = null
    if (this.channel) void this.client.removeChannel(this.channel)
    this.channel = null
  }

  /** Forgets this venue on this device, unsent changes included. For signing out. */
  async clearLocal(): Promise<void> {
    this.stop()
    this.outbox.clear()
    await this.persist(async () => {
      const queued = await this.readOutbox()
      await delMany(
        queued.map((change) => this.outboxKey(change)),
        idb().outbox,
      )
      await del(this.venueId, idb().cache)
    })
  }

  /* Loading -------------------------------------------------------------- */

  private async restore(): Promise<AppData | null> {
    let cached: CachedVenue | undefined
    let queued: RecordChange[] = []
    try {
      cached = await get<CachedVenue>(this.venueId, idb().cache)
      queued = await this.readOutbox()
    } catch {
      // Storage is blocked (some private modes): start from the server instead.
    }
    for (const change of queued) this.outbox.set(recordKey(change), { ...change, seq: ++this.seq })

    if (cached?.version === CACHE_VERSION && cached.data) {
      this.sortKeys = cached.sortKeys
      this.cursor = cached.cursor
      this.setStatus({ lastSyncedAt: cached.lastSyncedAt })
      // Another tab may have queued changes that this copy of the cache predates.
      const data = withMissingLists(cached.data)
      this.snapshot = queued.length > 0 ? applyChanges(data, queued) : data
      trackSortKeys(this.sortKeys, queued)
      this.ready()
      return this.snapshot
    }

    // First time on this device: the venue may already have records from elsewhere.
    const rows = await this.fetchWhenPossible()
    if (rows === null) return null
    if (rows.length > 0) {
      const built = buildData(rows.map(toChange))
      this.snapshot = built.data
      this.sortKeys = built.sortKeys
      this.cursor = newest(rows, null)
      await this.persist(() => this.writeCache())
      this.ready()
      return this.snapshot
    }

    // A venue with nothing in it yet. Records this device kept before it synced
    // are carried over: with no snapshot to diff against, the store's first
    // save queues every one of them for upload. Syncing starts with that save.
    return (await this.legacy?.load()) ?? null
  }

  /** Every live record of the venue, however long it takes to reach the server. */
  private async fetchWhenPossible(): Promise<RecordRow[] | null> {
    for (;;) {
      const blocked = await this.blocked()
      if (blocked) {
        this.setStatus({ state: blocked })
      } else {
        try {
          this.setStatus({ state: 'syncing' })
          const rows = await this.fetch(null, true)
          this.setStatus({ state: 'synced', lastSyncedAt: new Date().toISOString() })
          return rows
        } catch (error) {
          this.fail(error)
        }
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve
        setTimeout(resolve, RETRY_MS)
      })
      this.wake = null
      // Signed out while waiting.
      if (!this.active) return null
    }
  }

  private ready(): void {
    this.loaded = true
    this.requestSync()
  }

  /* Syncing -------------------------------------------------------------- */

  private readonly nudge = () => {
    this.wake?.()
    this.requestSync()
  }

  private readonly wentOffline = () => this.setStatus({ state: 'offline' })

  private readonly cameBack = () => {
    if (document.visibilityState === 'visible') this.nudge()
  }

  private requestSync(delay = 0): void {
    if (!this.loaded || !this.active) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delay)
  }

  private async sync(): Promise<void> {
    if (this.syncing) {
      this.again = true
      return
    }
    this.syncing = true
    try {
      do {
        this.again = false
        const blocked = await this.blocked()
        if (blocked) {
          this.setStatus({ state: blocked })
          return
        }
        this.setStatus({ state: 'syncing' })
        await this.adoptOrphans()
        await this.push()
        await this.pull()
        this.setStatus({ state: 'synced', lastSyncedAt: new Date().toISOString() })
      } while (this.again && this.active)
    } catch (error) {
      this.fail(error)
    } finally {
      this.syncing = false
    }
  }

  /** Why a sync can't run right now, or null when it can. */
  private async blocked(): Promise<'offline' | 'signed-out' | null> {
    if (!navigator.onLine) return 'offline'
    const { data, error } = await this.client.auth.getSession()
    if (data.session?.user.id === this.venueId) return null
    // A token refresh that failed for want of a network isn't a sign-out.
    return error && isAuthRetryableFetchError(error) ? 'offline' : 'signed-out'
  }

  /** Picks up changes another tab queued but never sent, because it closed while offline. */
  private async adoptOrphans(): Promise<void> {
    let queued: RecordChange[] = []
    // Queued behind this tab's own writes, so it never sees an upload's entries before they're cleared.
    await this.persist(async () => {
      queued = await this.readOutbox()
    })
    for (const change of queued) {
      const key = recordKey(change)
      if (!this.outbox.has(key)) this.outbox.set(key, { ...change, seq: ++this.seq })
    }
  }

  private async push(): Promise<void> {
    while (this.outbox.size > 0) {
      const batch = [...this.outbox.values()].slice(0, PUSH_BATCH)
      const { error } = await this.client.from(TABLE).upsert(
        batch.map((change) => ({
          venue_id: this.venueId,
          collection: change.collection,
          id: change.id,
          data: change.data,
          deleted: change.data === null,
          sort: change.sort,
        })),
        { onConflict: 'venue_id,collection,id' },
      )
      if (error) throw error

      // Anything edited again while this batch was on its way still has to go.
      const sent = batch.filter((change) => this.outbox.get(recordKey(change))?.seq === change.seq)
      for (const change of sent) this.outbox.delete(recordKey(change))
      this.setStatus({})
      await this.persist(() =>
        delMany(
          sent.map((change) => this.outboxKey(change)),
          idb().outbox,
        ),
      )
    }
  }

  private async pull(): Promise<void> {
    const since = this.cursor && new Date(Date.parse(this.cursor) - PULL_OVERLAP_MS).toISOString()
    const rows = await this.fetch(since)
    if (rows.length === 0) return

    this.cursor = newest(rows, this.cursor)
    const current = this.snapshot ?? EMPTY_DATA
    const changes = rows
      .map(toChange)
      // A local edit still waiting to go up stays as it is until it has.
      .filter((change) => !this.outbox.has(recordKey(change)) && !holds(current, change))

    if (changes.length > 0) {
      this.snapshot = applyChanges(current, changes)
      trackSortKeys(this.sortKeys, changes)
      for (const listener of this.remoteListeners) listener(changes)
    }
    await this.persist(() => this.writeCache())
  }

  private async fetch(since: string | null, liveOnly = false): Promise<RecordRow[]> {
    const rows: RecordRow[] = []
    // Paged until an empty page rather than a short one: a project can cap rows
    // per request below PAGE_SIZE, and a short page would then look like the end.
    for (;;) {
      let query = this.client.from(TABLE).select(COLUMNS).eq('venue_id', this.venueId)
      if (since) query = query.gt('updated_at', since)
      if (liveOnly) query = query.eq('deleted', false)
      const { data, error } = await query
        .order('updated_at')
        .order('collection')
        .order('id')
        .range(rows.length, rows.length + PAGE_SIZE - 1)
      if (error) throw error
      if (data.length === 0) return rows
      rows.push(...(data as RecordRow[]))
    }
  }

  private fail(error: unknown): void {
    if (isNetworkFailure(error)) this.setStatus({ state: 'offline' })
    else this.setStatus({ state: 'error', error: describe(error) })
  }

  private setStatus(changes: Partial<SyncStatus>): void {
    const next: SyncStatus = { ...this.status, ...changes, pending: this.outbox.size }
    if (next.state !== 'error') next.error = null
    const unchanged = (Object.keys(next) as (keyof SyncStatus)[]).every((key) => next[key] === this.status[key])
    if (unchanged) return
    this.status = next
    for (const listener of this.statusListeners) listener()
  }

  /* Storage -------------------------------------------------------------- */

  /**
   * Runs storage writes one after another. A failed write (quota, blocked
   * storage) is swallowed: the session carries on in memory.
   */
  private persist(write: () => Promise<unknown>): Promise<void> {
    this.writes = this.writes.then(write).then(
      () => undefined,
      () => undefined,
    )
    return this.writes
  }

  private writeCache(): Promise<void> {
    const cached: CachedVenue = {
      version: CACHE_VERSION,
      data: this.snapshot,
      sortKeys: this.sortKeys,
      cursor: this.cursor,
      lastSyncedAt: this.status.lastSyncedAt,
    }
    return set(this.venueId, cached, idb().cache)
  }

  private outboxKey(change: RecordChange): string {
    return `${this.venueId}|${recordKey(change)}`
  }

  private async readOutbox(): Promise<RecordChange[]> {
    const prefix = `${this.venueId}|`
    const stored = await entries<string, RecordChange>(idb().outbox)
    return stored.filter(([key]) => key.startsWith(prefix)).map(([, change]) => change)
  }
}

function toChange(row: RecordRow): RecordChange {
  return { collection: row.collection, id: row.id, data: row.deleted ? null : row.data, sort: row.sort }
}

function newest(rows: RecordRow[], cursor: string | null): string | null {
  let latest = cursor
  for (const row of rows) {
    if (latest === null || Date.parse(row.updated_at) > Date.parse(latest)) latest = row.updated_at
  }
  return latest
}

/** How Chrome, Firefox and Safari word a request that never reached the server. */
function isNetworkFailure(error: unknown): boolean {
  return !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(describe(error))
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message)
  return String(error)
}
