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
    <div className="min-w-[176px] border-2 border-ink bg-paper px-3 py-2.5 shadow-[6px_6px_0_0_#000]">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-1.5">
        <span className="font-mono text-[11px] font-bold">:{row.port}</span>
        <span className="num font-sans text-[16px] font-black">
          {formatNumber(row.total)} 次
        </span>
      </div>
      <p className="mt-1.5 truncate font-mono text-[11px] font-bold">
        {row.name}
      </p>
      <div className="mt-2 space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 border border-ink bg-electric-cyan" />
            已放行
          </span>
          <span className="num">{formatNumber(row.allow)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 border border-ink bg-hot-pink" />
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
      <div className="grid h-[194px] place-items-center border-2 border-ink bg-slab font-mono text-[12px] font-bold uppercase tracking-[0.08em]">
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
            stroke="#000000"
            strokeDasharray="2 4"
            strokeOpacity={0.18}
          />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="port"
            width={46}
            axisLine={{ stroke: '#000000', strokeWidth: 2 }}
            tickLine={false}
            tick={{
              fill: '#000000',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: '#f4f4f4' }} />
          <Bar
            dataKey="allow"
            name="已放行"
            stackId="traffic"
            fill="#00d9ff"
            stroke="#000000"
            strokeWidth={2}
            barSize={12}
            isAnimationActive={!reduceMotion}
            animationDuration={450}
          />
          <Bar
            dataKey="block"
            name="已拦截"
            stackId="traffic"
            fill="#ff006e"
            stroke="#000000"
            strokeWidth={2}
            barSize={12}
            isAnimationActive={!reduceMotion}
            animationDuration={450}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
