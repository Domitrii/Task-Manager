/**
 * Photos kept on this device: ones taken here (until they're uploaded, and a
 * while after so they show straight away) and ones downloaded to look at.
 *
 * The pictures and what's known about them are kept apart, so working out
 * what to upload or clear out never has to read every picture into memory.
 */
import { createStore, delMany, entries, get, set, type UseStore } from 'idb-keyval'

export interface PhotoInfo {
  /** When it was taken or downloaded. */
  savedAt: string
  /** False until it's on the server. Always true where there's no server. */
  uploaded: boolean
}

let stores: { blobs: UseStore; index: UseStore } | null = null
function idb() {
  stores ??= { blobs: createStore('mise-photos', 'blobs'), index: createStore('mise-photo-index', 'photos') }
  return stores
}

export async function keepPhoto(path: string, blob: Blob, uploaded: boolean): Promise<void> {
  // The picture first: an index entry without one would be uploaded as nothing.
  await set(path, blob, idb().blobs)
  await set(path, { savedAt: new Date().toISOString(), uploaded } satisfies PhotoInfo, idb().index)
}

export function photoBlob(path: string): Promise<Blob | undefined> {
  return get<Blob>(path, idb().blobs)
}

export async function markUploaded(path: string): Promise<void> {
  const info = await get<PhotoInfo>(path, idb().index)
  if (info) await set(path, { ...info, uploaded: true } satisfies PhotoInfo, idb().index)
}

/** Every photo kept under a path prefix, e.g. one team's. */
export async function photosUnder(prefix: string): Promise<[string, PhotoInfo][]> {
  const stored = await entries<string, PhotoInfo>(idb().index)
  return stored.filter(([path]) => path.startsWith(prefix))
}

export async function forgetPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await delMany(paths, idb().index)
  await delMany(paths, idb().blobs)
}
