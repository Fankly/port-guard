import {
  ArrowDownToLine,
  Ban,
  CircleCheck,
  Globe2,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
  RotateCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  downloadFile,
  formatNumber,
  formatTime,
  toCsv,
} from '../data'
import type { PlatformId } from '../lib/platform'
import { platformCopy } from '../lib/platform'
import { useAppStore } from '../store/app-store'
import { useAccessLogs } from '../hooks/use-access-logs'
import { PageHeader } from '../components/shared/page-header'
import { SearchField } from '../components/shared/search-field'
import { Segmented } from '../components/shared/segmented'
import {
  EmptyState,
  ProtocolTag,
  ResultBadge,
} from '../components/shared/status'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Select } from '../components/ui/select'

export default function AccessLog({ platform }: { platform: PlatformId }) {
  const logs = useAccessLogs()
  const accessEvents = logs.events
  const logLabel = platformCopy(platform).logLabel
  const rules = useAppStore(state => state.rules)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<'all' | 'allow' | 'block'>('all')
  const [port, setPort] = useState('all')
  const [protocol, setProtocol] = useState<'all' | 'tcp' | 'udp'>('all')

  const ports = [
    ...new Set([
      ...accessEvents.map(event => event.port),
      ...rules.map(rule => rule.port),
    ]),
  ].sort((a, b) => a - b)
  const total = accessEvents.reduce((sum, event) => sum + event.count, 0)
  const blocked = accessEvents
    .filter(event => event.result === 'block')
    .reduce((sum, event) => sum + event.count, 0)
  const blockedEvents = accessEvents.filter(
    event => event.result === 'block',
  ).length
  const sources = new Set(accessEvents.map(event => event.source)).size

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return accessEvents
      .filter(event => result === 'all' || event.result === result)
      .filter(event => port === 'all' || event.port === Number(port))
      .filter(event => protocol === 'all' || event.protocol === protocol)
      .filter(
        event =>
          !search ||
          event.source.toLowerCase().includes(search) ||
          String(event.port).includes(search),
      )
      .slice()
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [query, result, port, protocol, accessEvents])

  const hasFilters =
    query !== '' || result !== 'all' || port !== 'all' || protocol !== 'all'
  const latest = accessEvents[0]?.time.slice(11, 19) ?? '—'

  function clearFilters() {
    setQuery('')
    setResult('all')
    setPort('all')
    setProtocol('all')
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['时间', '远端 IP', '本机端口', '协议', '结果', 'PF 规则编号', '次数'],
      ...filtered.map(event => [
        event.time,
        event.source,
        event.port,
        event.protocol.toUpperCase(),
        event.result === 'allow' ? '放行' : '拦截',
        event.ruleLabel ?? '—',
        event.count,
      ]),
    ]
    downloadFile(
      `port-guard-access-${formatTime().slice(0, 10)}.csv`,
      `\uFEFF${toCsv(rows)}`,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div>
      <PageHeader
        label="Access / 访问"
        title="访问日志"
        description="查看过滤层记录的连接与访问尝试。放行只代表过滤层允许，不代表服务一定响应成功。"
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <ArrowDownToLine className="size-4" strokeWidth={3} />
            导出 CSV
          </Button>
        }
      />

      <Card className="mb-5 space-y-2 bg-slab p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{logs.statusLabel}{logs.data?.interface ? ` · ${logs.data.interface}` : ''}</h2>
          <Button size="sm" variant="secondary" disabled={logs.isFetching} onClick={() => void logs.refetch()}><RotateCw className="size-4" />{logs.isFetching ? '读取中' : '连接 / 重新读取'}</Button>
        </div>
        <p role="status" className="text-xs leading-relaxed">{logs.isError ? logs.error.message : logs.data?.message ?? '正在读取本机日志接口状态。'}</p>
        {logs.data && <p className="text-xs">检查时间 {formatTime(new Date(logs.data.checkedAt))} · 未解码 {logs.data.undecodable} 条 · 内核丢弃 {logs.data.kernelDropped ?? '未知'} · 显示最近 1000 条已存储事件</p>}
      </Card>

      <Card className="mb-6 grid border-2 shadow-[8px_8px_0_0_#000] sm:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="flex items-center gap-3 border-b-2 border-ink bg-ink px-4 py-4 text-paper sm:border-b-0 sm:border-r-2 sm:border-paper">
          <span className="grid size-10 shrink-0 place-items-center border-2 border-paper bg-acid-lime text-ink">
            <ShieldCheck className="size-5" strokeWidth={2.6} />
          </span>
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
              {logs.statusLabel}
            </span>
            <div className="num mt-1 font-sans text-[30px] font-black leading-[0.9]">
              {formatNumber(total)}{' '}
              <span className="font-mono text-[12px] font-bold">次访问</span>
            </div>
            <p className="mt-1 font-mono text-[11px]">最近一条记录于 {latest}</p>
          </div>
        </div>

        <SummaryCell
          icon={<Ban className="size-4" strokeWidth={2.6} />}
          label="已拦截"
          value={formatNumber(blocked)}
          hint={`${total > 0 ? ((blocked / total) * 100).toFixed(1) : '0'}% 的访问`}
          tone="danger"
        />
        <SummaryCell
          icon={<Globe2 className="size-4" strokeWidth={2.6} />}
          label="独立来源"
          value={String(sources)}
          hint={`${blockedEvents} 条拦截事件`}
        />
        <SummaryCell
          icon={<ShieldAlert className="size-4" strokeWidth={2.6} />}
          label="覆盖端口"
          value={String(new Set(accessEvents.map(event => event.port)).size)}
          hint="规则范围内"
        />
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b-2 border-ink bg-slab p-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="搜索来源 IP 或端口"
            label="搜索访问日志"
            className="sm:max-w-[280px]"
          />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Segmented
              value={result}
              onChange={setResult}
              ariaLabel="按结果筛选"
              options={[
                { value: 'all', label: '全部' },
                { value: 'block', label: '已拦截' },
                { value: 'allow', label: '已放行' },
              ]}
            />
            <Select
              value={port}
              onChange={event => setPort(event.target.value)}
              aria-label="目标端口"
              className="w-[124px]"
            >
              <option value="all">全部端口</option>
              {ports.map(item => (
                <option key={item} value={item}>
                  端口 {item}
                </option>
              ))}
            </Select>
            <Select
              value={protocol}
              onChange={event =>
                setProtocol(event.target.value as typeof protocol)
              }
              aria-label="协议"
              className="w-[110px]"
            >
              <option value="all">全部协议</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" strokeWidth={3} />
                重置
              </Button>
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <caption className="sr-only">
              真实 PFLOG 元数据，包含时间、远端地址、本机端口、协议、结果和规则编号
            </caption>
            <thead>
              <tr className="border-b-2 border-ink bg-ink font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-paper">
                <th scope="col" className="px-5 py-2.5 font-bold">时间</th>
                <th scope="col" className="px-3 py-2.5 font-bold">远端 IP</th>
                <th scope="col" className="px-3 py-2.5 font-bold">本机端口</th>
                <th scope="col" className="px-3 py-2.5 font-bold">协议</th>
                <th scope="col" className="px-3 py-2.5 font-bold">结果</th>
                <th scope="col" className="hidden px-3 py-2.5 font-bold xl:table-cell">PF 规则编号</th>
                <th scope="col" className="px-5 py-2.5 text-right font-bold">次数</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-ink">
              {filtered.map(event => (
                <tr
                  key={event.id}
                  className="transition-colors duration-150 hover:bg-slab"
                >
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="block font-mono text-[11px]">
                      {event.time.slice(5, 10).replace('-', '/')}
                    </span>
                    <code className="font-mono text-[11px] font-bold">
                      {event.time.slice(11)}
                    </code>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setQuery(event.source)}
                      title={`筛选来源 ${event.source}`}
                      className="border-b-2 border-transparent font-mono text-[11px] font-bold transition-colors hover:border-ink hover:bg-acid-lime"
                    >
                      {event.source}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="border border-ink bg-slab px-1.5 py-0.5 font-mono text-[12px] font-bold">
                      :{event.port}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <ProtocolTag protocol={event.protocol} />
                  </td>
                  <td className="px-3 py-3">
                    <ResultBadge result={event.result} />
                  </td>
                  <td className="hidden max-w-[200px] truncate px-3 py-3 font-mono text-[12px] xl:table-cell">
                    {event.ruleLabel ?? 'PF 规则编号未知'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="num font-mono text-[11px] font-bold">
                      {formatNumber(event.count)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y-2 divide-ink md:hidden">
          {filtered.map(event => (
            <div key={event.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setQuery(event.source)}
                  className="border-b-2 border-transparent font-mono text-[11px] font-bold hover:border-ink"
                >
                  {event.source}
                </button>
                <ResultBadge result={event.result} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="border border-ink bg-slab px-1.5 py-0.5 font-bold">
                  :{event.port}
                </span>
                <ProtocolTag protocol={event.protocol} />
                <span>·</span>
                <span>{event.ruleLabel ?? 'PF 规则编号未知'} · {event.direction === 'out' ? '出站' : '入站'}</span>
                <span className="ml-auto font-bold">
                  {event.time.slice(11)}
                </span>
              </div>
              <div className="mt-1.5 font-mono text-[11px]">
                合并计数{' '}
                <span className="num font-bold">
                  {formatNumber(event.count)}
                </span>{' '}
                次
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={<Search className="size-6" strokeWidth={2.4} />}
            title="没有符合条件的访问"
            description={logs.data?.status === 'connected' ? '当前已采集记录中没有匹配项；未采集或未记录 log 的流量不在统计范围内。' : logs.data?.message ?? '请检查上方日志源状态。'}
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                <CircleCheck className="size-3.5" strokeWidth={3} />
                清除筛选
              </Button>
            }
          />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink bg-slab px-4 py-3 font-mono text-[11px] sm:px-5">
          <span className="font-bold">
            共 {filtered.length} 条真实 PFLOG 事件
          </span>
          <span className="inline-flex items-center gap-1.5 border border-ink bg-tangerine px-1.5 py-px font-bold">
            <span className="size-1.5 bg-ink" />
            {logLabel} · {logs.statusLabel}
          </span>
        </footer>
      </Card>

      <div className="mt-6 flex gap-3 border-2 border-ink bg-paper px-4 py-3.5 shadow-[4px_4px_0_0_#000]">
        <Ban className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
        <p className="font-mono text-[12px] leading-[1.7]">
          <strong className="font-bold">日志范围。</strong>
          只保存已读取的 TCP/UDP PFLOG 元数据。未解码、内核丢弃和日志读取失败会单独显示；普通网卡数据不会作为防火墙裁决。
        </p>
      </div>
    </div>
  )
}

function SummaryCell({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  tone?: 'danger'
}) {
  return (
    <div className="border-b-2 border-ink px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r-2 sm:last:border-r-0">
      <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
        <span className={tone === 'danger' ? 'text-hot-pink' : 'text-ink'}>
          {icon}
        </span>
        {label}
      </span>
      <div className="num mt-1.5 font-sans text-[28px] font-black leading-[0.9]">
        {value}
      </div>
      <p className="mt-1 font-mono text-[11px]">{hint}</p>
    </div>
  )
}
