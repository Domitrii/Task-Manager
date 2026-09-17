import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartTokens } from '@/lib/theme'

interface TrendPoint {
  label: string
  passed: number
  failed: number
  rate: number
}

function TooltipCard({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: string; color?: string }>
}) {
  const tokens = useChartTokens()
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: tokens.surface, borderColor: tokens.tooltipBorder, color: tokens.ink }}
    >
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-1.5 py-0.5">
          {row.color ? (
            <span className="inline-block size-2 rounded-[2px]" style={{ background: row.color }} />
          ) : null}
          <span style={{ color: tokens.axis }}>{row.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{row.value}</span>
        </p>
      ))}
    </div>
  )
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="text-ink-muted flex items-center gap-1.5 text-xs">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Temperature readings per day, split by outcome. Stacked because the pair sums
 * to "checks recorded that day" — a quantity managers genuinely read off it.
 */
export function ComplianceTrendChart({ data, height = 240 }: { data: TrendPoint[]; height?: number }) {
  const tokens = useChartTokens()

  return (
    <div>
      <Legend
        items={[
          { label: 'In range', color: tokens.pass },
          { label: 'Out of range', color: tokens.fail },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={tokens.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: tokens.axis, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: tokens.axis, fontSize: 11 }}
            width={46}
          />
          <Tooltip
            cursor={{ fill: tokens.grid, opacity: 0.45 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as TrendPoint
              return (
                <TooltipCard
                  title={String(label)}
                  rows={[
                    { label: 'In range', value: String(point.passed), color: tokens.pass },
                    { label: 'Out of range', value: String(point.failed), color: tokens.fail },
                    { label: 'Pass rate', value: `${point.rate}%` },
                  ]}
                />
              )
            }}
          />
          {/* A 1px surface stroke leaves a visible gap where the two fills meet. */}
          <Bar
            dataKey="passed"
            stackId="checks"
            fill={tokens.pass}
            stroke={tokens.surface}
            strokeWidth={1}
            isAnimationActive={false}
          />
          <Bar
            dataKey="failed"
            stackId="checks"
            fill={tokens.fail}
            stroke={tokens.surface}
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Single-series pass-rate line — the title names the series, so no legend box. */
export function PassRateChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const tokens = useChartTokens()

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke={tokens.grid} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: tokens.axis, fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          // Floors to the ten below the worst day rather than a fixed 60, so a
          // genuinely bad day is still drawn inside the plot.
          domain={[(dataMin: number) => Math.max(0, Math.floor((dataMin - 5) / 10) * 10), 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: tokens.axis, fontSize: 11 }}
          width={46}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          cursor={{ stroke: tokens.grid, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const point = payload[0].payload as TrendPoint
            return (
              <TooltipCard
                title={String(label)}
                rows={[
                  { label: 'Pass rate', value: `${point.rate}%`, color: tokens.brand },
                  { label: 'Checks recorded', value: String(point.passed + point.failed) },
                ]}
              />
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke={tokens.brand}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: tokens.surface }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
