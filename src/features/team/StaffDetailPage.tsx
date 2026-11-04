import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { CircleAlert, Clock, Check, TriangleAlert } from 'lucide-react'
import { staffRoleLabel } from '@/data/staffRoles'
import { useStore } from '@/data/store'
import { toISODate } from '@/lib/compliance'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { createId } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { InfoCard } from '@/components/shared/ListCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { useIsManager } from '@/features/temperatures/access'
import { certificateState, useClockedIn } from './TeamPage'

export function StaffDetailPage() {
  const { id } = useParams()
  const now = useNow()
  const { data, saveStaff } = useStore()
  const manager = useIsManager()
  const goBack = useGoBack('/team')
  const clockedIn = useClockedIn()
  const [adding, setAdding] = useState(false)
  const member = data.staff.find((entry) => entry.id === id)

  if (!member) return <Navigate to="/team" replace />

  const certificates = [...(member.certificates ?? [])].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))

  return (
    <div className="space-y-3.5">
      <PageHeader title="Staff detail" onBack={goBack} />

      <InfoCard title={member.name}>
        <p className="text-ink">{staffRoleLabel(member)}</p>
        <Badge icon={<Clock className="size-3.5" />} className="my-1">
          {clockedIn(member.id) ? 'Clocked in' : 'Clocked out'}
        </Badge>
        <p>{data.settings.venueName}</p>
      </InfoCard>

      <InfoCard title="Contact">
        <p className="text-ink">{member.email ?? 'No email on record'}</p>
      </InfoCard>

      <InfoCard title="Venue">
        <p className="text-ink">{data.settings.venueName}</p>
      </InfoCard>

      <InfoCard title="Training and certificates">
        {certificates.length === 0 ? <p>Nothing recorded yet.</p> : null}
        {certificates.map((certificate) => {
          const state = certificateState(certificate, now)
          const left = differenceInCalendarDays(parseISO(certificate.expiresOn), now)
          return (
            <div key={certificate.id} className="py-1">
              <p className="text-ink font-semibold">{certificate.name}</p>
              {state === 'ok' ? (
                <Badge tone="pass" icon={<Check className="size-3.5" />}>
                  Valid
                </Badge>
              ) : state === 'due-soon' ? (
                <Badge tone="warn" icon={<TriangleAlert className="size-3.5" />}>
                  Due soon
                </Badge>
              ) : (
                <Badge tone="fail" icon={<CircleAlert className="size-3.5" />}>
                  Expired
                </Badge>
              )}
              <p className="mt-0.5">
                Expires {format(parseISO(certificate.expiresOn), 'd MMM yyyy')}
                {left >= 0 ? ` · In ${left} ${left === 1 ? 'day' : 'days'}` : ''}
              </p>
            </div>
          )
        })}
        {manager ? (
          <Button size="sm" className="mt-1.5" onClick={() => setAdding(true)}>
            Add certificate
          </Button>
        ) : null}
      </InfoCard>

      {adding ? (
        <CertificateSheet
          today={toISODate(now)}
          onClose={() => setAdding(false)}
          onSave={(name, expiresOn) =>
            saveStaff({ ...member, certificates: [...(member.certificates ?? []), { id: createId('ce'), name, expiresOn }] })
          }
        />
      ) : null}
    </div>
  )
}

function CertificateSheet({
  today,
  onClose,
  onSave,
}: {
  today: string
  onClose: () => void
  onSave: (name: string, expiresOn: string) => void
}) {
  const [name, setName] = useState('Food hygiene certificate')
  const [expiresOn, setExpiresOn] = useState(today)
  return (
    <Modal
      open
      onClose={onClose}
      title="Add certificate"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={name.trim() === '' || expiresOn === ''}
            onClick={() => {
              onSave(name.trim(), expiresOn)
              onClose()
            }}
          >
            Save certificate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="certificate-name">
          <TextInput id="certificate-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Expires" htmlFor="certificate-expires">
          <TextInput
            id="certificate-expires"
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
