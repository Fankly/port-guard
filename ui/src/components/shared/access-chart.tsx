import { useReducedMotion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { formatNumber } from '../../data'

export type PortTraffic = {
  port: string
  name: string
  allow: number
  block: number
  total: number
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as PortTraffic | undefined
  if (!row) return null
  return (
    <div className="min-w-[168px] rounded-lg border border-border bg-card px-3 py-2.5 shadow-lift">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          :{row.port}
        </span>
        <span className="num text-[12px] font-semibold">
          {formatNumber(row.total)} 次
        </span>
      </div>
      <p className="mt-0.5 truncate text-[11.5px] text-foreground">{row.name}</p>
      <div className="mt-2 space-y-1 border-t border-border/70 pt-2 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-chart-allow" />
            已放行
          </span>
          <span className="num">{formatNumber(row.allow)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-chart-block" />
            已拦截
          </span>
          <span className="num">{formatNumber(row.block)}</span>
        </div>
      </div>
    </div>
  )
}

export function AccessByPortChart({ data }: { data: PortTraffic[] }) {
  const reduceMotion = useReducedMotion()

  if (data.length === 0) {
    return (
      <div className="grid h-[194px] place-items-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground">
        样本窗口内没有访问数据
      </div>
    )
  }

  return (
    <div className="h-[194px] w-full" role="img" aria-label="按端口的访问分布图">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 2, right: 6, bottom: 0, left: 0 }}
          barCategoryGap={9}
          accessibilityLayer
        >
          <CartesianGrid
            horizontal={false}
            stroke="#e8ece6"
            strokeDasharray="3 3"
          />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="port"
            width={42}
            axisLine={false}
            tickLine={false}
            tick={{
              fill: '#67746c',
              fontSize: 10.5,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ fill: 'rgba(15, 107, 79, 0.05)' }}
          />
          <Bar
            dataKey="allow"
            name="已放行"
            stackId="traffic"
            fill="#1e8b66"
            barSize={11}
            radius={[3, 0, 0, 3]}
            isAnimationActive={!reduceMotion}
            animationDuration={600}
          />
          <Bar
            dataKey="block"
            name="已拦截"
            stackId="traffic"
            fill="#c2604a"
            barSize={11}
            radius={[0, 3, 3, 0]}
            isAnimationActive={!reduceMotion}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
