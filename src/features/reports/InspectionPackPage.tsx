import { useMemo, useState, type ReactNode } from 'react'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { Printer } from 'lucide-react'
import { enteredNote } from '@/data/attribution'
import { selectProbeCalibration } from '@/data/attention'
import { staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatRange, startOfDayLocal } from '@/lib/compliance'
import { formatTemp } from '@/lib/format'
import { useGoBack } from '@/lib/useGoBack'
import { useNow } from '@/lib/useNow'
import { percent } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ChipTabs } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/shared/PageHeader'

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

const when = (value: string) => format(parseISO(value), 'd MMM yyyy, HH:mm')
const day = (value: string) => format(parseISO(value), 'd MMM yyyy')

/**
 * The due-diligence records an inspector asks for, on one page that prints
 * cleanly or saves as a PDF from the browser's print dialog: every reading with
 * who took it, what was done when one was out of range, checklists, deliveries,
 * issues, training and probe calibration.
 */
export function InspectionPackPage() {
  const now = useNow()
  const { data, activeStaff } = useStore()
  const goBack = useGoBack('/reports')
  const [range, setRange] = useState('14')
  const days = Number(range)
  const from = useMemo(() => startOfDayLocal(subDays(now, days - 1)), [now, days])
  const since = (value: string) => parseISO(value) >= from

  const items = new Map(data.items.map((item) => [item.id, item]))
  const logs = data.temperatureLogs.filter((log) => since(log.recordedAt)).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
  const failed = logs.filter((log) => log.outcome === 'fail')
  const runs = data.checklistRuns.filter((run) => since(run.completedAt)).sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const deliveries = data.deliveries.filter((delivery) => since(delivery.receivedAt)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  const issues = data.issues
    .filter((issue) => since(issue.raisedAt) || issue.status !== 'resolved')
    .sort((a, b) => a.raisedAt.localeCompare(b.raisedAt))
  const templates = new Map(data.checklistTemplates.map((template) => [template.id, template]))
  const calibration = selectProbeCalibration(data, now)
  const certificates = data.staff
    .filter((person) => person.active)
    .flatMap((person) => (person.certificates ?? []).map((certificate) => ({ person, certificate })))
    .sort((a, b) => a.certificate.expiresOn.localeCompare(b.certificate.expiresOn))
  const rejected = deliveries.flatMap((delivery) => delivery.lines.filter((line) => !line.accepted).map((line) => ({ delivery, line })))

  return (
    <div className="space-y-6 print:space-y-4 print:text-black">
      <div className="print:hidden">
        <PageHeader
          title="Inspection pack"
          onBack={goBack}
          description="Everything an inspection asks for, ready to print or save as a PDF."
          actions={
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print or save as PDF
            </Button>
          }
        />
        <div className="mt-3.5">
          <ChipTabs label="Period" value={range} onChange={setRange} options={RANGES} />
        </div>
      </div>

      <header className="border-line border-b pb-3">
        <h1 className="font-display text-ink text-2xl font-bold print:text-black">{data.settings.venueName}</h1>
        {data.settings.address ? <p className="text-ink-muted text-sm">{data.settings.address}</p> : null}
        <p className="text-ink-muted text-sm">
          Food safety records, {day(from.toISOString())} to {day(now.toISOString())} ({days} days). Printed{' '}
          {when(now.toISOString())} by {activeStaff.name}.
        </p>
      </header>

      <Section title="Summary">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <Fact label="Temperature readings" value={logs.length} />
          <Fact label="Out of range" value={`${failed.length} (${100 - percent(logs.length - failed.length, logs.length)}%)`} />
          <Fact label="Checklists signed off" value={runs.length} />
          <Fact label="Deliveries checked" value={deliveries.length} />
          <Fact label="Delivery lines rejected" value={rejected.length} />
          <Fact label="Issues still open" value={data.issues.filter((issue) => issue.status !== 'resolved').length} />
          <Fact label="Probe calibration" value={calibration.needed ? `Due · ${calibration.detail}` : calibration.detail} />
        </dl>
      </Section>

      <Section title="Readings out of range, and what was done" empty={failed.length === 0 ? 'None in this period.' : undefined}>
        <Table head={['When', 'Equipment', 'Reading', 'Checked by', 'What was done']}>
          {failed.map((log) => (
            <tr key={log.id}>
              <Cell>{when(log.recordedAt)}</Cell>
              <Cell>{items.get(log.itemId)?.name ?? 'Removed equipment'}</Cell>
              <Cell>
                {formatTemp(log.temperature)}
                {items.get(log.itemId) ? <span className="text-ink-muted block">Safe {formatRange(items.get(log.itemId)!)}</span> : null}
              </Cell>
              <Cell>{staffName(data, log.recordedBy)}</Cell>
              <Cell>{log.correctiveAction ?? 'Not recorded'}</Cell>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Every temperature reading" empty={logs.length === 0 ? 'None in this period.' : undefined}>
        <Table head={['When', 'Equipment', 'Reading', 'Result', 'Checked by']}>
          {logs.map((log) => {
            const note = enteredNote(data, log, log.recordedBy, log.recordedAt)
            return (
              <tr key={log.id}>
                <Cell>{when(log.recordedAt)}</Cell>
                <Cell>{items.get(log.itemId)?.name ?? 'Removed equipment'}</Cell>
                <Cell>{formatTemp(log.temperature)}</Cell>
                <Cell>{log.outcome === 'pass' ? 'In range' : 'Out of range'}</Cell>
                <Cell>
                  {staffName(data, log.recordedBy)}
                  {note ? <span className="text-ink-muted block">{note}</span> : null}
                  {log.edits?.length ? <span className="text-ink-muted block">Changed after saving</span> : null}
                </Cell>
              </tr>
            )
          })}
        </Table>
      </Section>

      <Section title="Sign-off checklists" empty={runs.length === 0 ? 'None in this period.' : undefined}>
        <Table head={['Signed off', 'Checklist', 'By', 'Failed checks']}>
          {runs.map((run) => {
            const template = templates.get(run.templateId)
            const fails = run.results.filter((result) => result.status === 'fail')
            const note = enteredNote(data, run, run.completedBy, run.completedAt)
            return (
              <tr key={run.id}>
                <Cell>{when(run.completedAt)}</Cell>
                <Cell>{template?.name ?? 'Removed checklist'}</Cell>
                <Cell>
                  {staffName(data, run.completedBy)}
                  {note ? <span className="text-ink-muted block">{note}</span> : null}
                </Cell>
                <Cell>
                  {fails.length === 0
                    ? 'None'
                    : fails
                        .map((result) => {
                          const label = template?.items.find((item) => item.id === result.itemId)?.label ?? 'A check'
                          return result.note ? `${label}: ${result.note}` : label
                        })
                        .join('; ')}
                </Cell>
              </tr>
            )
          })}
        </Table>
      </Section>

      <Section title="Deliveries" empty={deliveries.length === 0 ? 'None in this period.' : undefined}>
        <Table head={['Received', 'Supplier', 'Checked by', 'Lines', 'Rejected']}>
          {deliveries.map((delivery) => {
            const out = delivery.lines.filter((line) => !line.accepted)
            return (
              <tr key={delivery.id}>
                <Cell>{when(delivery.receivedAt)}</Cell>
                <Cell>{data.suppliers.find((supplier) => supplier.id === delivery.supplierId)?.name ?? 'Unknown supplier'}</Cell>
                <Cell>{staffName(data, delivery.checkedBy)}</Cell>
                <Cell>{delivery.lines.length}</Cell>
                <Cell>
                  {out.length === 0
                    ? 'None'
                    : out.map((line) => `${line.product}${line.rejectionReason ? ` (${line.rejectionReason})` : ''}`).join('; ')}
                </Cell>
              </tr>
            )
          })}
        </Table>
      </Section>

      <Section title="Issues" empty={issues.length === 0 ? 'None raised in this period, and none open.' : undefined}>
        <Table head={['Raised', 'Issue', 'Status', 'What was done', 'Signed off']}>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <Cell>{day(issue.raisedAt)}</Cell>
              <Cell>
                {issue.title}
                <span className="text-ink-muted block">{issue.severity} severity</span>
              </Cell>
              <Cell>{issue.status === 'in_progress' ? 'In progress' : issue.status === 'open' ? 'Open' : 'Resolved'}</Cell>
              <Cell>{issue.resolution ?? '—'}</Cell>
              <Cell>
                {issue.signedOffBy && issue.signedOffAt
                  ? `${staffName(data, issue.signedOffBy)}, ${day(issue.signedOffAt)}`
                  : issue.needsSignOff
                    ? 'Waiting'
                    : '—'}
              </Cell>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Training" empty={certificates.length === 0 ? 'No certificates recorded.' : undefined}>
        <Table head={['Name', 'Certificate', 'Expires']}>
          {certificates.map(({ person, certificate }) => {
            const left = differenceInCalendarDays(parseISO(certificate.expiresOn), now)
            return (
              <tr key={`${person.id}-${certificate.id}`}>
                <Cell>{person.name}</Cell>
                <Cell>{certificate.name}</Cell>
                <Cell>
                  {day(certificate.expiresOn)}
                  {left < 0 ? <span className="text-fail-700 block font-semibold">Expired</span> : null}
                </Cell>
              </tr>
            )
          })}
        </Table>
      </Section>
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty?: string; children: ReactNode }) {
  return (
    <section className="space-y-2 print:break-inside-auto">
      <h2 className="text-ink text-base font-semibold print:text-black">{title}</h2>
      {empty ? <p className="text-ink-muted text-sm">{empty}</p> : children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-1">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink text-right font-medium">{value}</dd>
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[36rem] border-collapse text-left text-[13px] print:min-w-0 print:text-[11px]">
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label} className="text-ink-muted border-line border-b py-1.5 pr-3 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="text-ink border-line border-b py-1.5 pr-3 align-top print:text-black">{children}</td>
}
