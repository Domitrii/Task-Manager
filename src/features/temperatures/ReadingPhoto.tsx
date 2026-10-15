/**
 * The photo that proves a reading: taking it on the way in, and showing it
 * afterwards to whoever may see it.
 */
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImageOff, Lock } from 'lucide-react'
import { useStore } from '@/data/store'
import type { TemperatureLog } from '@/data/types'
import { preparePhoto } from '@/lib/photo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { canSeePhoto, useReadingAccess } from './access'

/** A photo for a new reading, or a new photo for one being changed. */
export function PhotoProofField({
  id,
  photo,
  onChange,
  caption,
  error,
  label = 'Photo',
  hint = 'Of the probe or display, with the temperature showing.',
  action = 'Take a photo',
  required = true,
  size = 'md',
}: {
  id: string
  photo: Blob | null
  onChange: (photo: Blob) => void
  /** Stamped along the bottom of the photo: what, when and who. Worked out when it's taken. */
  caption: () => string
  error?: string
  label?: string
  hint?: string
  /** What the button says before there's a photo. */
  action?: string
  required?: boolean
  size?: 'md' | 'lg'
}) {
  const input = useRef<HTMLInputElement>(null)
  const preview = usePreview()
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function picked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Cleared, so taking the same picture again still counts as a change.
    event.target.value = ''
    if (!file) return
    setPreparing(true)
    setProblem(null)
    try {
      const prepared = await preparePhoto(file, caption())
      preview.show(prepared)
      onChange(prepared)
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setPreparing(false)
    }
  }

  const message = problem ?? error

  return (
    <div>
      <p className={cn('text-ink mb-1.5 font-semibold', size === 'lg' ? 'text-[15px]' : 'text-sm')}>
        {label} {required ? <span className="text-fail-600">*</span> : null}
      </p>
      {/* `capture` opens the camera straight away on phones and tablets. */}
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void picked(event)}
      />
      {photo && preview.url ? (
        <div className="flex items-center gap-3">
          <img
            src={preview.url}
            alt="Photo of the reading"
            className={cn('border-line rounded-lg border object-cover', size === 'lg' ? 'size-24' : 'size-20')}
          />
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">Photo added</p>
            <Button
              size="sm"
              disabled={preparing}
              onClick={() => input.current?.click()}
              className="mt-1.5 gap-1.5"
            >
              <Camera className="size-4" />
              {preparing ? 'Preparing…' : 'Retake'}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={preparing}
          onClick={() => input.current?.click()}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 text-left transition-colors disabled:opacity-60',
            size === 'lg' ? 'py-5' : 'py-3.5',
            message ? 'border-fail-500' : 'border-line-strong hover:border-brand-500',
          )}
        >
          <span className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 flex size-11 shrink-0 items-center justify-center rounded-xl">
            <Camera className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="text-ink block text-[15px] font-semibold">
              {preparing ? 'Preparing photo…' : action}
            </span>
            <span className="text-ink-muted block text-[13px]">{hint}</span>
          </span>
        </button>
      )}
      {message ? (
        <p role="alert" className="text-fail-600 mt-1.5 text-xs">
          {message}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A saved reading's photo, small, opening full size. Other people's photos are
 * only for managers, so everyone else just sees that there is one.
 */
export function ReadingPhoto({ log, size = 'sm' }: { log: TemperatureLog; size?: 'sm' | 'lg' }) {
  const access = useReadingAccess()
  if (!log.photo) {
    return <span className="text-ink-subtle text-[11px]">No photo</span>
  }
  if (!canSeePhoto(log, access)) {
    return (
      <span
        title="Only managers see photos of other people’s readings"
        className="text-ink-subtle inline-flex items-center gap-1 text-[11px]"
      >
        <Lock className="size-3" />
        Photo
      </span>
    )
  }
  return <StoredPhoto path={log.photo} size={size} />
}

export function StoredPhoto({ path, size = 'sm' }: { path: string; size?: 'sm' | 'lg' }) {
  const { url, loading } = usePhotoUrl(path)
  const [open, setOpen] = useState(false)
  const box = size === 'lg' ? 'size-24 rounded-lg' : 'size-10 rounded-md'

  if (!url) {
    return (
      <span
        title={loading ? 'Loading the photo' : 'Not uploaded yet from the device that took it, or you’re offline'}
        className={cn('bg-surface-muted text-ink-subtle inline-flex shrink-0 items-center justify-center', box)}
      >
        {loading ? <Camera className="size-4 animate-pulse" /> : <ImageOff className="size-4" />}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show the photo full size"
        className={cn('border-line block shrink-0 overflow-hidden border', box)}
      >
        <img src={url} alt="" className="size-full object-cover" />
      </button>
      {open ? (
        <Modal open onClose={() => setOpen(false)} title="Photo of the reading" size="lg">
          <img src={url} alt="Photo of the reading" className="w-full rounded-lg" />
        </Modal>
      ) : null}
    </>
  )
}

function usePhotoUrl(path: string): { url: string | null; loading: boolean } {
  const { photoUrl } = useStore()
  const [shown, setShown] = useState<{ path: string; url: string | null } | null>(null)

  useEffect(() => {
    let live = true
    let url: string | null = null
    photoUrl(path).then(
      (next) => {
        if (live) {
          url = next
          setShown({ path, url: next })
        } else if (next) {
          URL.revokeObjectURL(next)
        }
      },
      () => live && setShown({ path, url: null }),
    )
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [path, photoUrl])

  const current = shown?.path === path ? shown : null
  return { url: current?.url ?? null, loading: current === null }
}

/** The photo just taken, as something an <img> can show, let go of when it's replaced or the field goes. */
function usePreview() {
  const [url, setUrl] = useState<string | null>(null)
  const current = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current)
    },
    [],
  )
  function show(blob: Blob) {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = URL.createObjectURL(blob)
    setUrl(current.current)
  }
  return { url, show }
}
