/**
 * Persistence boundary.
 *
 * The app only ever talks to a `DataRepository`. Today that is backed by
 * localStorage; swapping in an HTTP implementation (POS, sensor feed, supplier
 * EDI) means implementing this interface and changing the single construction
 * call in `main.tsx` — no UI changes.
 */
import { createSeedData } from './seed'
import type { AppData } from './types'

export interface DataRepository {
  /**
   * The venue's stored data, or `null` when this device has none yet. A first
   * run is routed to setup rather than given demo data it didn't ask for.
   */
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
  /** Discards local state and rebuilds the demo dataset. */
  reset(): Promise<AppData>
}

const STORAGE_KEY = 'mise.appdata.v1'
/** Bump when the shape of `AppData` changes so stale local state is discarded. */
const SCHEMA_VERSION = 2

interface StoredEnvelope {
  version: number
  savedAt: string
  data: AppData
}

export class LocalStorageRepository implements DataRepository {
  private readonly key: string

  constructor(key: string = STORAGE_KEY) {
    this.key = key
  }

  async load(): Promise<AppData | null> {
    try {
      const raw = localStorage.getItem(this.key)
      if (raw) {
        const envelope = JSON.parse(raw) as StoredEnvelope
        if (envelope.version === SCHEMA_VERSION && envelope.data) return envelope.data
      }
    } catch {
      // Corrupt or blocked storage (private mode) — treated the same as none.
    }
    return null
  }

  async save(data: AppData): Promise<void> {
    try {
      const envelope: StoredEnvelope = {
        version: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        data,
      }
      localStorage.setItem(this.key, JSON.stringify(envelope))
    } catch {
      // Quota exceeded or storage unavailable — the session still works in memory.
    }
  }

  async reset(): Promise<AppData> {
    const data = createSeedData(new Date())
    await this.save(data)
    return data
  }
}

/** In-memory repository, useful for tests. Starts empty unless given data. */
export class InMemoryRepository implements DataRepository {
  private data: AppData | null

  constructor(initial: AppData | null = null) {
    this.data = initial
  }

  async load(): Promise<AppData | null> {
    return this.data
  }

  async save(data: AppData): Promise<void> {
    this.data = data
  }

  async reset(): Promise<AppData> {
    this.data = createSeedData(new Date())
    return this.data
  }
}
