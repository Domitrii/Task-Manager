import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useStore } from '@/data/store'
import type { StaffMember } from '@/data/types'
import { staffRoleLabel } from '@/data/staffRoles'
import { checkPin, hashPin, PIN_PATTERN } from '@/lib/pin'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { LogoMark } from '@/components/layout/Logo'
import { readLockAfter, SharedLockContext, type SharedLock } from './sharedDeviceState'
import { useSync } from './sync'

/**
 * A shared kitchen device: a tablet signed in as a manager that stays in the
 * kitchen. People take it over with their PIN, so what they record goes down in
 * their name and they can do what they could on their own phone, no more. It
 * locks itself when nobody has touched it for a while, and on every reload.
 */

const BLOCKED_KEY = 'mise.pinBlockedUntil'
/** Wrong PINs in a row before the device makes everyone wait. */
const TRIES = 5
const WAIT_MS = 30_000

/**
 * Keeps a shared device locked until someone unlocks it, and locks it again
 * after `readLockAfter` idle minutes. Wraps the app shell.
 */
export function SharedDeviceGate({ children, onLock }: { children: ReactNode; onLock: () => void }) {
  const sync = useSync()
  const { sharedDevice, setSharedDevice } = useStore()
  const active = Boolean(sync && sharedDevice)
  // Every reload starts locked: whoever was using it may have walked off. Only
  // counts while it's a shared device; see `value.locked`.
  const [locked, setLocked] = useState(active)

  // Only a manager's account can be left in the kitchen like this.
  useEffect(() => {
    if (sync && sharedDevice && !sync.isManager) setSharedDevice(false)
  }, [sync, sharedDevice, setSharedDevice])

  // `onLock` closes whatever sheet is open, so the next person doesn't find it.
  useEffect(() => {
    if (!active || locked) return
    const minutes = readLockAfter()
    const lockNow = () => {
      onLock()
      setLocked(true)
    }
    let timer = window.setTimeout(lockNow, minutes * 60_000)
    const touched = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(lockNow, minutes * 60_000)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    for (const name of events) window.addEventListener(name, touched, { passive: true, capture: true })
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, touched, { capture: true })
    }
  }, [active, locked, onLock])

  const value: SharedLock = {
    active,
    locked: active && locked,
    lock: () => {
      onLock()
      setLocked(true)
    },
  }

  return (
    <SharedLockContext value={value}>
      {children}
      {value.locked ? <WhoIsUsing onUnlocked={() => setLocked(false)} /> : null}
    </SharedLockContext>
  )
}

function blockedFor(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(BLOCKED_KEY) ?? 0) - Date.now())
  } catch {
    return 0
  }
}

let misses = 0

/** A PIN typed in and checked against someone's. Slow on purpose, and it waits after too many wrong ones. */
function PinForm({ person, onRight, submitLabel }: { person: StaffMember; onRight: () => void; submitLabel: string }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const wait = blockedFor()
    if (wait > 0) {
      setError(`Too many wrong PINs. Try again in ${Math.ceil(wait / 1000)} seconds.`)
      return
    }
    setBusy(true)
    const right = await checkPin(pin, person.pinHash)
    setBusy(false)
    if (right) {
      misses = 0
      onRight()
      return
    }
    misses += 1
    setPin('')
    if (misses >= TRIES) {
      misses = 0
      try {
        localStorage.setItem(BLOCKED_KEY, String(Date.now() + WAIT_MS))
      } catch {
        // Storage blocked: the count still holds until a reload.
      }
      setError(`Too many wrong PINs. Try again in ${WAIT_MS / 1000} seconds.`)
    } else {
      setError('That PIN isn’t right.')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={`${person.name}’s PIN`} htmlFor="unlock-pin" error={error ?? undefined}>
        <TextInput
          id="unlock-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={6}
          className="h-12 text-center text-xl tracking-[0.4em]"
          value={pin}
          invalid={Boolean(error)}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" block disabled={busy || pin.length < 4}>
        {busy ? 'Checking…' : submitLabel}
      </Button>
    </form>
  )
}

/** Asking for someone's PIN before they take the device over. */
export function PinDialog({ person, onRight, onClose }: { person: StaffMember; onRight: () => void; onClose: () => void }) {
  return (
    <Modal open variant="alert" onClose={onClose} title={`Switch to ${person.name}`} description="Enter their kitchen PIN.">
      <PinForm person={person} onRight={onRight} submitLabel="Switch" />
      <Button block className="mt-2" onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  )
}

/** The locked screen of a shared device: choose yourself, then your PIN. */
function WhoIsUsing({ onUnlocked }: { onUnlocked: () => void }) {
  const { data, setActiveStaffId } = useStore()
  const [chosen, setChosen] = useState<StaffMember | null>(null)
  const people = data.staff.filter((person) => person.active)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Who’s using this device?"
      className="bg-app fixed inset-0 z-(--layer-lock) overflow-y-auto px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10 rounded-xl" />
          <LockKeyhole className="text-ink-muted size-5" />
        </div>
        {chosen ? (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-3">
              <Avatar person={chosen} size="lg" />
              <div className="min-w-0">
                <h1 className="font-display text-ink text-2xl font-bold">Hi, {chosen.name.split(' ')[0]}</h1>
                <p className="text-ink-muted text-sm">{staffRoleLabel(chosen)}</p>
              </div>
            </div>
            <PinForm
              person={chosen}
              submitLabel="Unlock"
              onRight={() => {
                setActiveStaffId(chosen.id)
                onUnlocked()
              }}
            />
            <Button block onClick={() => setChosen(null)}>
              Not you?
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-ink mt-6 text-[28px] leading-tight font-bold">Who’s using this device?</h1>
            <p className="text-ink-muted mt-2 text-sm">
              {data.settings.venueName} · It locked itself to keep everyone’s records in the right name.
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={!person.pinHash}
                    onClick={() => setChosen(person)}
                    className="bg-surface shadow-card rounded-card flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-60"
                  >
                    <Avatar person={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block truncate text-[15px] font-semibold">{person.name}</span>
                      <span className="text-ink-muted block truncate text-xs">
                        {person.pinHash ? staffRoleLabel(person) : 'No PIN yet. Ask a manager.'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/** Choosing a PIN: your own, or anyone's if you're a manager. */
export function SetPinModal({ person, onClose }: { person: StaffMember; onClose: () => void }) {
  const { activeStaff, saveStaff } = useStore()
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const own = person.id === activeStaff.id
  const invalid = pin.length > 0 && !PIN_PATTERN.test(pin)
  const mismatch = repeat.length > 0 && repeat !== pin
  const ready = PIN_PATTERN.test(pin) && pin === repeat

  async function save() {
    if (!ready || busy) return
    setBusy(true)
    const pinHash = await hashPin(pin)
    saveStaff({ ...person, pinHash })
    toast.success(own ? 'Your PIN is set' : `${person.name}’s PIN is set`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={own ? (person.pinHash ? 'Change your PIN' : 'Choose your PIN') : `${person.name}’s PIN`}
      description="4 to 6 numbers, for taking over a shared kitchen device. Avoid a birthday or 1234."
      footer={
        <>
          {person.pinHash ? (
            <Button
              onClick={() => {
                saveStaff({ ...person, pinHash: undefined })
                toast.success(own ? 'Your PIN is removed' : `${person.name}’s PIN is removed`)
                onClose()
              }}
            >
              Remove PIN
            </Button>
          ) : null}
          <Button variant={ready ? 'primary' : 'secondary'} disabled={!ready || busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save PIN'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New PIN" htmlFor="set-pin" error={invalid ? 'Use 4 to 6 numbers.' : undefined}>
          <TextInput
            id="set-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin}
            invalid={invalid}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Type it again" htmlFor="set-pin-repeat" error={mismatch ? 'The two PINs don’t match.' : undefined}>
          <TextInput
            id="set-pin-repeat"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={repeat}
            invalid={mismatch}
            onChange={(event) => setRepeat(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
      </div>
    </Modal>
  )
}

