import {
  ArrowDownToLine,
  Ban,
  CircleCheck,
  Globe2,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  demoAccess,
  downloadFile,
  formatNumber,
  formatTime,
  toCsv,
} from '../data'
import { useAppStore } from '../store/app-store'
import { PageHeader } from '../components/shared/page-header'
import { SearchField } from '../components/shared/search-field'
import { Segmented } from '../components/shared/segmented'
import {
  EmptyState,
  LiveDot,
  ProtocolTag,
  ResultBadge,
} from '../components/shared/status'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Select } from '../components/ui/select'

export default function AccessLog() {
  const rules = useAppStore(state => state.rules)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<'all' | 'allow' | 'block'>('all')
  const [port, setPort] = useState('all')
  const [protocol, setProtocol] = useState<'all' | 'tcp' | 'udp'>('all')

  const ports = [
    ...new Set([
      ...demoAccess.map(event => event.port),
      ...rules.map(rule => rule.port),
    ]),
  ].sort((a, b) => a - b)
  const total = demoAccess.reduce((sum, event) => sum + event.count, 0)
  const blocked = demoAccess
    .filter(event => event.result === 'block')
    .reduce((sum, event) => sum + event.count, 0)
  const blockedEvents = demoAccess.filter(
    event => event.result === 'block',
  ).length
  const sources = new Set(demoAccess.map(event => event.source)).size

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return demoAccess
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
  }, [query, result, port, protocol])

  const hasFilters =
    query !== '' || result !== 'all' || port !== 'all' || protocol !== 'all'
  const latest = demoAccess[0]?.time.slice(11, 19) ?? '—'

  function ruleName(value: number): string {
    return (
      rules.find(item => item.port === value)?.name ??
      '未配置端口'
    )
  }

  function clearFilters() {
    setQuery('')
    setResult('all')
    setPort('all')
    setProtocol('all')
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['时间', '来源 IP', '目标端口', '协议', '结果', '命中规则', '次数'],
      ...filtered.map(event => [
        event.time,
        event.source,
        event.port,
        event.protocol.toUpperCase(),
        event.result === 'allow' ? '放行' : '拦截',
        ruleName(event.port),
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
        title="访问日志"
        description="查看过滤层记录的连接与访问尝试。放行只代表过滤层允许，不代表服务一定响应成功。"
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <ArrowDownToLine className="size-3.5" />
            导出 CSV
          </Button>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <div className="grid divide-y divide-border sm:grid-cols-[1.25fr_repeat(3,1fr)] sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <ShieldCheck className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <LiveDot className="scale-90" />
                日志采集正常 · 样本窗口
              </span>
              <div className="num mt-0.5 text-[19px] font-semibold leading-tight">
                {formatNumber(total)}{' '}
                <span className="text-[11px] font-normal text-muted-foreground">
                  次访问
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                最近一条记录于 {latest}
              </p>
            </div>
          </div>

          <SummaryCell
            icon={<Ban className="size-3.5" />}
            label="已拦截"
            value={formatNumber(blocked)}
            hint={`${total > 0 ? ((blocked / total) * 100).toFixed(1) : '0'}% 的访问`}
            tone="danger"
          />
          <SummaryCell
            icon={<Globe2 className="size-3.5" />}
            label="独立来源"
            value={String(sources)}
            hint={`${blockedEvents} 条聚合拦截`}
          />
          <SummaryCell
            icon={<ShieldAlert className="size-3.5" />}
            label="覆盖端口"
            value={String(new Set(demoAccess.map(event => event.port)).size)}
            hint="规则范围内"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-border/70 p-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="搜索来源 IP 或端口"
            label="搜索访问日志"
            className="sm:max-w-[250px]"
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
              className="w-[118px]"
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
              className="w-[104px]"
            >
              <option value="all">全部协议</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" />
                重置
              </Button>
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <caption className="sr-only">
              过滤层访问样本，包含时间、来源、端口、协议、结果、命中规则与次数
            </caption>
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <th scope="col" className="px-5 py-2 font-medium">时间</th>
                <th scope="col" className="px-3 py-2 font-medium">来源 IP</th>
                <th scope="col" className="px-3 py-2 font-medium">目标端口</th>
                <th scope="col" className="px-3 py-2 font-medium">协议</th>
                <th scope="col" className="px-3 py-2 font-medium">结果</th>
                <th scope="col" className="hidden px-3 py-2 font-medium xl:table-cell">命中规则</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">次数</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(event => (
                <tr
                  key={event.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/35"
                >
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <span className="block text-[10px] text-muted-foreground">
                      {event.time.slice(5, 10).replace('-', '/')}
                    </span>
                    <code className="font-mono text-[11px]">
                      {event.time.slice(11)}
                    </code>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setQuery(event.source)}
                      title={`筛选来源 ${event.source}`}
                      className="rounded font-mono text-[11px] transition-colors hover:text-primary hover:underline hover:underline-offset-2"
                    >
                      {event.source}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/80">
                      :{event.port}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ProtocolTag protocol={event.protocol} />
                  </td>
                  <td className="px-3 py-2.5">
                    <ResultBadge result={event.result} />
                  </td>
                  <td className="hidden max-w-[200px] truncate px-3 py-2.5 text-[11px] text-muted-foreground xl:table-cell">
                    {ruleName(event.port)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="num font-mono text-[11px]">
                      {formatNumber(event.count)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden">
          {filtered.map(event => (
            <div
              key={event.id}
              className="border-b border-border/60 px-4 py-3 last:border-0"
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setQuery(event.source)}
                  className="font-mono text-[11.5px] font-medium"
                >
                  {event.source}
                </button>
                <ResultBadge result={event.result} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/75">
                  :{event.port}
                </span>
                <ProtocolTag protocol={event.protocol} />
                <span>·</span>
                <span>{ruleName(event.port)}</span>
                <span className="ml-auto font-mono">
                  {event.time.slice(11)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                合并计数{' '}
                <span className="num font-mono text-foreground/80">
                  {formatNumber(event.count)}
                </span>{' '}
                次
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={<Search className="size-5" />}
            title="没有符合条件的访问"
            description="换一个来源、端口或结果筛选。空列表只表示样本数据里没有匹配项。"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                <CircleCheck className="size-3.5" />
                清除筛选
              </Button>
            }
          />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 text-[10.5px] text-muted-foreground sm:px-5">
          <span>
            共 {filtered.length} 条聚合事件 · 相同来源、端口与结果会合并计数
          </span>
          <span className="flex items-center gap-1.5 text-warning">
            <span className="size-1.5 rounded-full bg-[#c08a35]" />
            界面演示样本 · 未连接 PF 日志
          </span>
        </footer>
      </Card>

      <div className="mt-3 flex gap-2.5 rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
        <Ban className="mt-0.5 size-3.5 shrink-0" />
        <p>
          <strong className="font-medium text-foreground">
            拦截日志可能出现汇总。
          </strong>
          同源高频请求会按窗口合并；如果日志读取失败，界面会显示采集中断，而不是用空列表表示“没有访问”。
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
    <div className="px-4 py-3.5 sm:px-5">
      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span
          className={
            tone === 'danger' ? 'text-destructive' : 'text-muted-foreground'
          }
        >
          {icon}
        </span>
        {label}
      </span>
      <div className="num mt-0.5 text-[19px] font-semibold leading-tight">
        {value}
      </div>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}
