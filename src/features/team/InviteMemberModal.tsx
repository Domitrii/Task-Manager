import { useState } from 'react'
import { STAFF_ROLE_LABELS, STAFF_ROLES } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import type { StaffRole } from '@/data/types'
import { Button } from '@/components/ui/Button'
import { Field, ProblemCount, Select, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { InfoCard } from '@/components/shared/ListCard'
import { useSync } from '@/features/account/sync'

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/**
 * Keeps the invitation on the team page and, on a synced team, opens an email
 * with the join code in it. There's no server here to send mail, so it goes
 * from the inviter's own email app.
 */
export function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const { data, saveInvitation } = useStore()
  const sync = useSync()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole | ''>('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const venue = data.settings.venueName

  const badEmail = submitted && !validEmail(email.trim())
  const noRole = submitted && role === ''
  const problems = [badEmail, noRole].filter(Boolean).length

  async function send() {
    setSubmitted(true)
    if (!validEmail(email.trim()) || role === '') return
    setBusy(true)
    const code = await sync?.teamDetails().then(
      (details) => details.code,
      () => null,
    )
    saveInvitation({ email: email.trim(), role })
    if (code) {
      const subject = encodeURIComponent(`Join ${venue} on Mise`)
      const body = encodeURIComponent(`You’re invited to join ${venue} on Mise. Sign up, choose “Join a team” and enter this code: ${code}`)
      window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`
      toast.success('Invitation ready', 'Send the email that’s just opened, with your join code.')
    } else {
      toast.success('Invitation added')
    }
    setBusy(false)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="page"
      title="Invite team member"
      footer={
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void send()}>
          Send invitation
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-muted text-[13px]">Invite someone to {venue}. Required fields are marked *</p>
        <ProblemCount count={problems} />
        <Field label="Email" required htmlFor="invite-email" error={badEmail ? 'Enter a valid email address' : undefined}>
          <TextInput
            id="invite-email"
            type="email"
            autoFocus
            value={email}
            invalid={badEmail}
            placeholder="name@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label="Role"
          required
          htmlFor="invite-role"
          error={noRole ? 'Choose a role before sending the invitation.' : undefined}
        >
          <Select
            id="invite-role"
            value={role}
            invalid={noRole}
            onChange={(event) => setRole(event.target.value as StaffRole)}
          >
            <option value="">Choose a role</option>
            {STAFF_ROLES.map((entry) => (
              <option key={entry} value={entry}>
                {STAFF_ROLE_LABELS[entry]}
              </option>
            ))}
          </Select>
        </Field>
        <InfoCard title="Venue">
          <p className="text-ink">{venue}</p>
          <p>The invitation is for this venue only.</p>
        </InfoCard>
        <p className="text-ink-muted text-[13px]">
          An invited person appears as pending, not clocked in, active or trained, until they join.
        </p>
      </div>
    </Modal>
  )
}
