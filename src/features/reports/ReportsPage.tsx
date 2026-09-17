import { useMemo, useState } from 'react'
import { subDays } from 'date-fns'
import { Download, Package, Percent, ThermometerSnowflake, TriangleAlert } from 'lucide-react'
import { selectComplianceTrend, staffName } from '@/data/selectors'
import { useStore } from '@/data/store'
import { formatRange, startOfDayLocal } from '@/lib/compliance'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatDateTime, formatTemp } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn, percent, sum } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/Tabs'
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { RateChart, TrendChart } from '@/components/shared/LazyCharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { ProgressBar } from '@/components/shared/ProgressRing'
import { StatCard } from '@/components/shared/StatCard'

type RangeKey = '7' | '14' | '30'

export function ReportsPage() {
  const now = useNow()
  const { data } = useStore()
  const toast = useToast()
  const [range, setRange] = useState<RangeKey>('14')

  const days = Number(range)
  const cutoff = useMemo(() => startOfDayLocal(subDays(now, days - 1)), [now, days])

  const logs = useMemo(
    () => data.temperatureLogs.filter((log) => new Date(log.recordedAt) >= cutoff),
    [data.temperatureLogs, cutoff],
  )
  const deliveries = useMemo(
    () => data.deliveries.filter((delivery) => new Date(delivery.receivedAt) >= cutoff),
    [data.deliveries, cutoff],
  )
  const runs = useMemo(
    () => data.checklistRuns.filter((run) => new Date(run.completedAt) >= cutoff),
    [data.checklistRuns, cutoff],
  )

  const trend = useMemo(() => selectComplianceTrend(data, days, now), [data, days, now])

  const failures = logs.filter((log) => log.outcome === 'fail')
  const passRate = percent(logs.length - failures.length, logs.length)

  const deliveryLines = deliveries.flatMap((delivery) => delivery.lines)
  const rejectedLines = deliveryLines.filter((line) => !line.accepted)

  const byEquipment = useMemo(() => {
    return data.items
      .map((item) => {
        const itemLogs = logs.filter((log) => log.itemId === item.id)
        const itemFailures = itemLogs.filter((log) => log.outcome === 'fail')
        const temps = itemLogs.map((log) => log.temperature)
        return {
          item,
          count: itemLogs.length,
          failures: itemFailures.length,
          average: temps.length > 0 ? sum(temps) / temps.length : null,
          min: temps.length > 0 ? Math.min(...temps) : null,
          max: temps.length > 0 ? Math.max(...temps) : null,
          rate: percent(itemLogs.length - itemFailures.length, itemLogs.length),
        }
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => a.rate - b.rate || b.count - a.count)
  }, [data.items, logs])

  const bySupplier = useMemo(() => {
    return data.suppliers
      .map((supplier) => {
        const supplierDeliveries = deliveries.filter((delivery) => delivery.supplierId === supplier.id)
        const lines = supplierDeliveries.flatMap((delivery) => delivery.lines)
        const rejected = lines.filter((line) => !line.accepted)
        return {
          supplier,
          deliveries: supplierDeliveries.length,
          lines: lines.length,
          rejected: rejected.length,
          rate: percent(rejected.length, lines.length),
        }
      })
      .filter((row) => row.deliveries > 0)
      .sort((a, b) => b.rate - a.rate)
  }, [data.suppliers, deliveries])

  function exportTemperatures() {
    downloadCsv(
      `temperature-records-${days}-days.csv`,
      logs.map((log) => {
        const item = data.items.find((entry) => entry.id === log.itemId)
        return {
          'Recorded at': formatDateTime(log.recordedAt),
          Equipment: item?.name ?? '',
          Location: item?.location ?? '',
          'Safe range': item ? formatRange(item) : '',
          'Temperature (C)': log.temperature,
          Outcome: log.outcome === 'pass' ? 'In range' : 'Out of range',
          Check: log.period ?? 'Ad-hoc',
          'Recorded by': staffName(data, log.recordedBy),
          'Corrective action': log.correctiveAction ?? '',
        }
      }),
    )
    toast.success('Temperature records exported', `${logs.length} rows downloaded as CSV.`)
  }

  function exportDeliveries() {
    downloadCsv(
      `delivery-records-${days}-days.csv`,
      deliveries.flatMap((delivery) => {
        const supplier = data.suppliers.find((entry) => entry.id === delivery.supplierId)
        return delivery.lines.map((line) => ({
          'Received at': formatDateTime(delivery.receivedAt),
          Supplier: supplier?.name ?? '',
          Product: line.product,
          Category: line.category,
          Quantity: line.quantity,
          Unit: line.unit,
          'Temperature (C)': line.temperature ?? '',
          Packaging: line.packaging,
          'Use by': line.useBy ?? '',
          'Best before': line.bestBefore ?? '',
          Status: line.accepted ? 'Accepted' : 'Rejected',
          'Rejection reason': line.rejectionReason ?? '',
          'Checked by': staffName(data, delivery.checkedBy),
        }))
      }),
    )
    toast.success('Delivery records exported', `${deliveryLines.length} rows downloaded as CSV.`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Due-diligence records across temperatures, deliveries and checklists — the evidence an inspection asks for."
        actions={
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Temperature records"
          value={logs.length}
          sublabel={`Last ${days} days · from ${formatDate(cutoff.toISOString())}`}
          icon={<ThermometerSnowflake className="size-4" />}
        />
        <StatCard
          label="Pass rate"
          value={`${passRate}%`}
          sublabel={`${failures.length} reading${failures.length === 1 ? '' : 's'} out of range`}
          icon={<Percent className="size-4" />}
          tone={passRate >= 95 ? 'pass' : passRate >= 90 ? 'warn' : 'fail'}
        />
        <StatCard
          label="Delivery lines checked"
          value={deliveryLines.length}
          sublabel={`${deliveries.length} deliveries received`}
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Lines rejected"
          value={rejectedLines.length}
          sublabel={`${percent(rejectedLines.length, deliveryLines.length)}% of everything received`}
          icon={<TriangleAlert className="size-4" />}
          tone={rejectedLines.length > 0 ? 'warn' : 'pass'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Checks recorded per day"
            description="Every temperature reading, split by outcome"
          />
          <CardBody>
            <TrendChart data={trend} height={260} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Daily pass rate" description="Share of readings inside their safe range" />
          <CardBody>
            <RateChart data={trend} height={286} />
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Equipment performance"
          description="Worst performing first — this is where an inspection will start"
          action={
            <Button size="sm" onClick={exportTemperatures} className="gap-1.5">
              <Download className="size-4" />
              Export CSV
            </Button>
          }
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Equipment</Th>
              <Th numeric>Checks</Th>
              <Th numeric>Failures</Th>
              <Th numeric>Average</Th>
              <Th numeric>Range recorded</Th>
              <Th>Pass rate</Th>
            </tr>
          </thead>
          <tbody>
            {byEquipment.map((row) => (
              <Tr key={row.item.id}>
                <Td>
                  <span className="text-ink block text-[13px] font-medium">{row.item.name}</span>
                  <span className="text-ink-subtle text-[11px]">
                    {row.item.location} · safe {formatRange(row.item)}
                  </span>
                </Td>
                <Td numeric>
                  <span className="text-ink-muted text-[13px]">{row.count}</span>
                </Td>
                <Td numeric>
                  <span
                    className={cn(
                      'text-[13px] font-medium',
                      row.failures > 0 ? 'text-fail-600 dark:text-fail-500' : 'text-ink-muted',
                    )}
                  >
                    {row.failures}
                  </span>
                </Td>
                <Td numeric>
                  <span className="text-ink text-[13px]">
                    {row.average === null ? '—' : formatTemp(row.average)}
                  </span>
                </Td>
                <Td numeric>
                  <span className="text-ink-muted text-[13px]">
                    {row.min === null ? '—' : `${formatTemp(row.min)} – ${formatTemp(row.max)}`}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <ProgressBar
                        value={row.rate}
                        tone={row.rate >= 95 ? 'pass' : row.rate >= 90 ? 'warn' : 'fail'}
                      />
                    </div>
                    <span className="tabular text-ink-muted text-[13px]">{row.rate}%</span>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Supplier performance"
          description="Rejection rate by supplier over the selected period"
          action={
            <Button size="sm" onClick={exportDeliveries} className="gap-1.5">
              <Download className="size-4" />
              Export CSV
            </Button>
          }
        />
        <TableWrap>
          <thead>
            <tr>
              <Th>Supplier</Th>
              <Th numeric>Deliveries</Th>
              <Th numeric>Lines</Th>
              <Th numeric>Rejected</Th>
              <Th>Rejection rate</Th>
            </tr>
          </thead>
          <tbody>
            {bySupplier.map((row) => (
              <Tr key={row.supplier.id}>
                <Td>
                  <span className="text-ink text-[13px] font-medium">{row.supplier.name}</span>
                </Td>
                <Td numeric>
                  <span className="text-ink-muted text-[13px]">{row.deliveries}</span>
                </Td>
                <Td numeric>
                  <span className="text-ink-muted text-[13px]">{row.lines}</span>
                </Td>
                <Td numeric>
                  <span
                    className={cn(
                      'text-[13px] font-medium',
                      row.rejected > 0 ? 'text-fail-600 dark:text-fail-500' : 'text-ink-muted',
                    )}
                  >
                    {row.rejected}
                  </span>
                </Td>
                <Td>
                  {row.rate === 0 ? (
                    <Badge tone="pass">No rejections</Badge>
                  ) : (
                    <Badge tone={row.rate > 10 ? 'fail' : 'warn'}>{row.rate}%</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader title="Checklist completion" description={`Signed-off runs in the last ${days} days`} />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.checklistTemplates
              .filter((template) => template.active)
              .map((template) => {
                const templateRuns = runs.filter((run) => run.templateId === template.id)
                const completion = percent(templateRuns.length, days)
                const failedItems = templateRuns.reduce(
                  (total, run) => total + run.results.filter((result) => result.status === 'fail').length,
                  0,
                )
                return (
                  <div key={template.id} className="border-line rounded-lg border p-3.5">
                    <p className="text-ink text-[13px] font-medium">{template.name}</p>
                    <p className="text-ink-muted mt-0.5 text-xs">
                      {templateRuns.length} of {days} days · {failedItems} failed item
                      {failedItems === 1 ? '' : 's'}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <ProgressBar
                        value={completion}
                        tone={completion >= 95 ? 'pass' : completion >= 80 ? 'warn' : 'fail'}
                      />
                      <span className="tabular text-ink-muted shrink-0 text-xs">{completion}%</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
