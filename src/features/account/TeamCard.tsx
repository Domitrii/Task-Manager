import { useEffect, useState } from 'react'
import { Copy, DoorOpen, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { SignOutModal } from './AccountCard'
import { useSync, type SyncApi } from './sync'
import { formatJoinCode, teamErrorMessage, type TeamDetails } from './team'

/** Settings → Team: the code others join with. Renders nothing when the app runs device-only. */
export function TeamCard() {
  const sync = useSync()
  const toast = useToast()
  const [details, setDetails] = useState<TeamDetails | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState<'new-code' | 'leave' | 'sign-out' | null>(null)

  const teamDetails = sync?.teamDetails
  useEffect(() => {
    if (!teamDetails) return
    let live = true
    teamDetails().then(
      (loaded) => live && setDetails(loaded),
      (error: unknown) => live && setFailure(teamErrorMessage(error)),
    )
    return () => {
      live = false
    }
  }, [teamDetails, attempt])

  if (!sync) return null
  const close = () => setDialog(null)

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(formatJoinCode(code))
      toast.success('Code copied', 'Send it to whoever is joining the team.')
    } catch {
      toast.error('Couldn’t copy', 'Read the code out or write it down instead.')
    }
  }

  return (
    <Card>
      <CardHeader
        title={sync.team.name}
        description={`Signed in as ${sync.email}${details?.role === 'owner' ? ' · Owner' : ''}`}
      />
      <CardBody className="space-y-4">
        <div>
          <p className="text-ink-muted text-[13px] font-medium">Team code</p>
          {details ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="text-ink font-mono text-2xl font-bold tracking-[0.2em]">
                {formatJoinCode(details.code)}
              </span>
              <Button size="sm" onClick={() => void copy(details.code)} className="gap-1.5">
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          ) : failure ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <p className="text-ink-muted text-sm">{failure}</p>
              <Button
                size="sm"
                onClick={() => {
                  setFailure(null)
                  setAttempt((count) => count + 1)
                }}
              >
                Try again
              </Button>
            </div>
          ) : (
            <p className="text-ink-subtle mt-1.5 text-sm">Loading…</p>
          )}
          <p className="text-ink-muted mt-2 text-[13px]">
            New people create an account, choose <span className="text-ink font-medium">Join a team</span> and
            enter this code. They’ll see all of {sync.team.name}’s records.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {details?.role === 'owner' ? (
            <Button variant="ghost" onClick={() => setDialog('new-code')} className="gap-1.5">
              <RefreshCw className="size-4" />
              New code
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setDialog('sign-out')} className="gap-1.5">
            <LogOut className="size-4" />
            Sign out
          </Button>
          <Button variant="ghost" onClick={() => setDialog('leave')} className="gap-1.5">
            <DoorOpen className="size-4" />
            Leave team
          </Button>
        </div>
      </CardBody>

      {dialog === 'new-code' ? (
        <NewCodeModal sync={sync} onClose={close} onChanged={(code) => details && setDetails({ ...details, code })} />
      ) : null}
      {dialog === 'leave' ? <LeaveTeamModal sync={sync} onClose={close} /> : null}
      {dialog === 'sign-out' ? <SignOutModal sync={sync} onClose={close} /> : null}
    </Card>
  )
}

function NewCodeModal({
  sync,
  onClose,
  onChanged,
}: {
  sync: SyncApi
  onClose: () => void
  onChanged: (code: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    try {
      onChanged(await sync.newJoinCode())
      onClose()
      toast.success('New team code', 'The old code no longer works.')
    } catch (failure) {
      setError(teamErrorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Make a new team code?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Changing…' : 'Make new code'}
          </Button>
        </>
      }
    >
      <p className="text-ink-muted text-[13px]">
        The current code stops working, so nobody else can join with it. Everyone already in the team stays in.
      </p>
      {error ? (
        <p role="alert" className="text-fail-600 dark:text-fail-500 mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}

function LeaveTeamModal({ sync, onClose }: { sync: SyncApi; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { pending } = sync.status

  async function confirm() {
    setBusy(true)
    try {
      await sync.leaveTeam()
    } catch (failure) {
      setError(teamErrorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Leave ${sync.team.name}?`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || pending > 0} onClick={() => void confirm()}>
            {busy ? 'Leaving…' : 'Leave team'}
          </Button>
        </>
      }
    >
      <p className="text-ink-muted text-[13px]">
        {pending > 0
          ? `${pending} ${pending === 1 ? 'record hasn’t' : 'records haven’t'} synced yet. Connect to the internet and wait for sync to finish before leaving, so the team keeps ${pending === 1 ? 'it' : 'them'}.`
          : 'The team and its records stay for everyone else. You’ll need the team code to join again.'}
      </p>
      {error ? (
        <p role="alert" className="text-fail-600 dark:text-fail-500 mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}
