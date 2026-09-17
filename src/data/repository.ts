/**
 * Persistence boundary.
 *
 * The app only ever talks to a `DataRepository`. Today that is backed by
 * localStorage with generated demo data; swapping in an HTTP implementation
 * (POS, sensor feed, supplier EDI) means implementing this interface and
 * changing the single construction call in `main.tsx` — no UI changes.
 */
import { createSeedData } from './seed'
import type { AppData } from './types'

export interface DataRepository {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
  /** Discards local state and rebuilds the demo dataset. */
  reset(): Promise<AppData>
}

const STORAGE_KEY = 'mise.appdata.v1'
/** Bump when the shape of `AppData` changes so stale local state is rebuilt. */
const SCHEMA_VERSION = 1

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

  async load(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(this.key)
      if (raw) {
        const envelope = JSON.parse(raw) as StoredEnvelope
        if (envelope.version === SCHEMA_VERSION && envelope.data) return envelope.data
      }
    } catch {
      // Corrupt or blocked storage (private mode) — fall through to a fresh set.
    }
    return this.reset()
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

/** In-memory repository, useful for tests and for demo mode without storage. */
export class InMemoryRepository implements DataRepository {
  private data: AppData = createSeedData(new Date())

  async load(): Promise<AppData> {
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
