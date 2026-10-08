import { useState, type FormEvent } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { describeStatus, useSync, type SyncApi } from './sync'

/** Settings → Data. Renders nothing when the app runs device-only. */
export function AccountCard() {
  const sync = useSync()
  const [dialog, setDialog] = useState<'sign-in' | 'sign-out' | null>(null)
  if (!sync) return null

  const view = describeStatus(sync.status)
  const Icon = view.icon
  const close = () => setDialog(null)

  return (
    <Card>
      <CardHeader title="Account & sync" description={`Signed in as ${sync.email}`} />
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="bg-surface-muted text-ink-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold">{view.title}</p>
            <p className="text-ink-muted text-[13px]">{view.detail}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sync.status.state === 'signed-out' ? (
            <Button variant="primary" onClick={() => setDialog('sign-in')}>
              Sign in again
            </Button>
          ) : (
            <Button onClick={sync.syncNow} className="gap-1.5">
              <RefreshCw className="size-4" />
              Sync now
            </Button>
          )}
          <Button variant="ghost" onClick={() => setDialog('sign-out')} className="gap-1.5">
            <LogOut className="size-4" />
            Sign out of this device
          </Button>
        </div>
      </CardBody>

      {dialog === 'sign-in' ? <SignInAgainModal sync={sync} onClose={close} /> : null}
      {dialog === 'sign-out' ? <SignOutModal sync={sync} onClose={close} /> : null}
    </Card>
  )
}

function SignInAgainModal({ sync, onClose }: { sync: SyncApi; onClose: () => void }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const failure = await sync.signInAgain(password)
    setBusy(false)
    if (failure) {
      setError(failure)
      return
    }
    onClose()
    toast.success('Signed in', 'Anything recorded meanwhile is syncing now.')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Sign in again"
      description={sync.email}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="sign-in-again" variant="primary" disabled={busy || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </>
      }
    >
      <form id="sign-in-again" onSubmit={submit}>
        <Field label="Password" htmlFor="sign-in-again-password" error={error ?? undefined}>
          <TextInput
            id="sign-in-again-password"
            type="password"
            autoComplete="current-password"
            value={password}
            invalid={Boolean(error)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}

export function SignOutModal({ sync, onClose }: { sync: SyncApi; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const { pending } = sync.status

  return (
    <Modal
      open
      onClose={onClose}
      title="Sign out of this device?"
      description={pending > 0 ? 'This cannot be undone.' : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={pending > 0 ? 'danger' : 'primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await sync.signOut()
            }}
          >
            {pending > 0 ? 'Sign out and discard' : 'Sign out'}
          </Button>
        </>
      }
    >
      <p className="text-ink-muted text-[13px]">
        {pending > 0
          ? `${pending} ${pending === 1 ? 'record hasn’t' : 'records haven’t'} synced yet. Signing out now deletes ${pending === 1 ? 'it' : 'them'} for good. Connect to the internet and wait for sync to finish to keep ${pending === 1 ? 'it' : 'them'}.`
          : 'The team’s records stay safe. You’ll need your email and password to sign in on this device again.'}
      </p>
    </Modal>
  )
}
