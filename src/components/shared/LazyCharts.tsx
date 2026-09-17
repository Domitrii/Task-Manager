import { Suspense, lazy, type ComponentProps } from 'react'
// Type-only: a value import here would pull Recharts back into the main chunk.
import type { ComplianceTrendChart, PassRateChart } from './ComplianceChart'

/**
 * Recharts is by far the heaviest dependency here and only two screens use it,
 * so it is split out of the initial bundle. The placeholder reserves the chart's
 * height to stop the surrounding cards jumping as it arrives.
 */
const LazyTrend = lazy(async () => ({
  default: (await import('./ComplianceChart')).ComplianceTrendChart,
}))
const LazyPassRate = lazy(async () => ({
  default: (await import('./ComplianceChart')).PassRateChart,
}))

function ChartFallback({ height }: { height: number }) {
  return (
    <div
      className="bg-surface-muted/60 flex animate-pulse items-center justify-center rounded-lg"
      style={{ height }}
    >
      <span className="text-ink-subtle text-xs">Loading chart…</span>
    </div>
  )
}

export function TrendChart(props: ComponentProps<typeof ComplianceTrendChart>) {
  return (
    <Suspense fallback={<ChartFallback height={(props.height ?? 240) + 28} />}>
      <LazyTrend {...props} />
    </Suspense>
  )
}

export function RateChart(props: ComponentProps<typeof PassRateChart>) {
  return (
    <Suspense fallback={<ChartFallback height={props.height ?? 220} />}>
      <LazyPassRate {...props} />
    </Suspense>
  )
}
