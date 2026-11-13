import {
  ArrowRight,
  Ban,
  Clock3,
  Network,
  Plus,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import type { PageId } from '../hooks/use-route'
import type { PlatformId } from '../lib/platform'
import { platformCopy } from '../lib/platform'
import { cn } from '../lib/utils'
import { demoAccess, formatNumber, protocolLabel, shortTime } from '../data'
import type { Rule } from '../data'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { useAppStore } from '../store/app-store'
const AccessByPortChart = lazy(() =>
  import('../components/shared/access-chart').then(module => ({
    default: module.AccessByPortChart,
  })),
)
import type { PortTraffic } from '../components/shared/access-chart'
import { PageHeader } from '../components/shared/page-header'
import {
  EmptyState,
  LiveDot,
  ProtocolTag,
  StatePill,
} from '../components/shared/status'
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'

type Props = {
  platform: PlatformId
  onNavigate: (page: PageId) => void
  onNewRule: () => void
  onToggle: (rule: Rule) => void
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
      <span className="inline-block size-1.5 shrink-0 bg-hot-pink" aria-hidden="true" />
      {children}
    </p>
  )
}

export default function Overview({
  platform,
  onNavigate,
  onNewRule,
  onToggle,
}: Props) {
  const engineName = platformCopy(platform).engineName
  const rules = useAppStore(state => state.rules)
  const operations = useAppStore(state => state.operations)

  const activeRules = rules.filter(rule => rule.enabled)
  const uniqueSources = new Set(
    activeRules.flatMap(rule => rule.sources.map(source => source.address)),
  )
  const allowed = demoAccess
    .filter(event => event.result === 'allow')
    .reduce((sum, event) => sum + event.count, 0)
  const blocked = demoAccess
    .filter(event => event.result === 'block')
    .reduce((sum, event) => sum + event.count, 0)
  const blockedSources = new Set(
    demoAccess
      .filter(event => event.result === 'block')
      .map(event => event.source),
  )
  const recentBlocked = demoAccess.filter(event => event.result === 'block')
  const hasActiveRules = activeRules.length > 0
  const today = new Date()
    .toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replaceAll('-', '.')

  const chartData: PortTraffic[] = [...new Set(demoAccess.map(e => e.port))]
    .sort((a, b) => a - b)
    .map(port => {
      const events = demoAccess.filter(event => event.port === port)
      const allow = events
        .filter(event => event.result === 'allow')
        .reduce((sum, event) => sum + event.count, 0)
      const block = events
        .filter(event => event.result === 'block')
        .reduce((sum, event) => sum + event.count, 0)
      return {
        port: String(port),
        name: rules.find(rule => rule.port === port)?.name ?? '未配置端口',
        allow,
        block,
        total: allow + block,
      }
    })

  return (
    <div>
      <PageHeader
        label="Overview / 总览"
        title={`${greeting()}，这里是本机端口概览`}
        description={
          <>
            {today} · 只把受管端口开放给名单内的来源，其余端口保持系统原有策略。
          </>
        }
        actions={
          <Button onClick={onNewRule}>
            <Plus className="size-4" strokeWidth={3} />
            新建规则
          </Button>
        }
      />

      <section
        data-dark-surface
        className="relative overflow-hidden border-4 border-ink bg-ink text-paper shadow-[10px_10px_0_0_#000]"
      >
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.35fr_0.9fr] lg:items-end lg:gap-10">
          <div className="min-w-0">
            <span className="inline-flex flex-wrap items-center gap-2 border-2 border-paper bg-ink px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-paper">
              {hasActiveRules ? <LiveDot /> : <span className="size-2 border-2 border-paper bg-hot-pink" />}
              {hasActiveRules ? '防护运行中' : '防护已暂停'}
              <span className="h-3 w-0.5 bg-paper" aria-hidden="true" />
              {engineName} ENGINE / LOCAL
            </span>

            <h2 className="mt-5 max-w-[720px] font-sans text-[32px] font-black leading-[0.95] tracking-[-0.02em] sm:text-[48px] lg:text-[64px]">
              {hasActiveRules ? (
                <>
                  <span className="block">只放行名单内的设备</span>
                  <span className="block">其余访问留在门外。</span>
                </>
              ) : (
                <>
                  <span className="block">规则已暂停，</span>
                  <span className="block">端口暂时处于未管理状态。</span>
                </>
              )}
            </h2>

            <p className="mt-4 max-w-[560px] font-mono text-[12px] leading-[1.7] text-paper">
              {hasActiveRules ? (
                <>
                  {activeRules.length} 个端口正在按白名单工作，样本窗口内已放行{' '}
                  <strong className="bg-acid-lime px-1 font-bold text-ink">
                    {formatNumber(allowed)}
                  </strong>{' '}
                  次访问、拦截{' '}
                  <strong className="bg-hot-pink px-1 font-bold text-ink">
                    {formatNumber(blocked)}
                  </strong>{' '}
                  次访问。
                </>
              ) : (
                <>启用任意一条规则后，只有白名单内的来源可以访问对应端口。</>
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="primary"
                className="border-paper shadow-[4px_4px_0_0_#ccff00] hover:border-ink hover:shadow-[10px_10px_0_0_#ccff00]"
                onClick={() => onNavigate('rules')}
              >
                管理端口规则
                <ArrowRight className="size-4" strokeWidth={3} />
              </Button>
              <Button
                variant="outline"
                className="border-paper bg-ink text-paper shadow-[4px_4px_0_0_#ff006e] hover:border-ink hover:text-ink hover:shadow-[10px_10px_0_0_#ff006e]"
                onClick={() => onNavigate('access')}
              >
                <ScrollText className="size-4" strokeWidth={3} />
                查看访问日志
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 border-2 border-paper">
            <div className="border-r-2 border-paper bg-ink px-3 py-4 sm:px-4">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-paper">
                生效规则
              </span>
              <strong className="num mt-2 block font-sans text-[38px] font-black leading-[0.9] text-acid-lime sm:text-[46px]">
                {String(activeRules.length).padStart(2, '0')}
              </strong>
              <small className="mt-2 block font-mono text-[11px] text-paper">
                {rules.length - activeRules.length} 条已停用
              </small>
            </div>
            <div className="border-r-2 border-paper bg-ink px-3 py-4 sm:px-4">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-paper">
                白名单来源
              </span>
              <strong className="num mt-2 block font-sans text-[38px] font-black leading-[0.9] text-electric-cyan sm:text-[46px]">
                {String(uniqueSources.size).padStart(2, '0')}
              </strong>
              <small className="mt-2 block font-mono text-[11px] text-paper">
                IP + CIDR 去重
              </small>
            </div>
            <div className="bg-ink px-3 py-4 sm:px-4">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-paper">
                样本拦截
              </span>
              <strong className="num mt-2 block font-sans text-[38px] font-black leading-[0.9] text-hot-pink sm:text-[46px]">
                {formatNumber(blocked)}
              </strong>
              <small className="mt-2 block font-mono text-[11px] text-paper">
                来自 {blockedSources.size} 个来源
              </small>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-12 xl:gap-8">
        <Card className="flex flex-col xl:col-span-7">
          <CardHeader>
            <div>
              <Kicker>Active ports</Kicker>
              <CardTitle className="mt-2">受保护端口</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2"
              onClick={() => onNavigate('rules')}
            >
              全部规则
              <ArrowRight className="size-3.5" strokeWidth={3} />
            </Button>
          </CardHeader>

          <div className="flex-1 divide-y-2 divide-ink px-4">
            {activeRules.map(rule => (
              <div
                key={rule.id}
                className="rule-list-row flex items-center gap-3 px-2 py-3"
              >
                <div className="w-16 shrink-0 border-2 border-ink bg-ink px-1.5 py-1.5 text-center text-paper">
                  <div className="num font-sans text-[20px] font-black leading-[0.95] tracking-[-0.02em]">
                    {rule.port}
                  </div>
                  <div className="mt-1 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-acid-lime">
                    {protocolLabel(rule.protocols)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate font-sans text-[16px] font-bold leading-tight">
                      {rule.name}
                    </strong>
                    <StatePill enabled className="hidden sm:inline-flex" />
                  </div>
                  <p className="mt-1 truncate font-mono text-[12px]">
                    {rule.sources.length} 个来源
                    {rule.sources.length > 0 && (
                      <span>
                        {' · '}
                        {rule.sources
                          .slice(0, 2)
                          .map(source => source.address)
                          .join(' · ')}
                        {rule.sources.length > 2 ? ' …' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <Switch
                  checked
                  onCheckedChange={() => onToggle(rule)}
                  aria-label={`停用 ${rule.name}`}
                />
              </div>
            ))}

            {!hasActiveRules && (
              <EmptyState
                icon={<ShieldCheck className="size-6" strokeWidth={2.4} />}
                title="还没有启用中的端口规则"
                description="新建规则后，受管端口将只允许名单内来源访问。"
                action={
                  <Button variant="secondary" size="sm" onClick={onNewRule}>
                    <Plus className="size-3.5" strokeWidth={3} />
                    新建规则
                  </Button>
                }
                className="py-10"
              />
            )}
          </div>

          <CardFooter>
            <span className="flex items-center gap-2">
              <Network className="size-4 shrink-0" strokeWidth={2.4} />
              未在列表中的端口不受本软件影响，保持系统防火墙原有行为。
            </span>
          </CardFooter>
        </Card>

        <Card className="flex flex-col xl:col-span-5">
          <CardHeader>
            <div>
              <Kicker>Sample window</Kicker>
              <CardTitle className="mt-2">访问分布</CardTitle>
              <p className="mt-1 font-mono text-[12px] leading-[1.5]">
                按目标端口聚合 · 样本数据
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 pt-1 font-mono text-[11px] font-bold uppercase">
              <span className="flex items-center gap-1.5">
                <span className="size-2 border border-ink bg-electric-cyan" />
                放行
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 border border-ink bg-hot-pink" />
                拦截
              </span>
            </div>
          </CardHeader>
          <div className="flex flex-1 items-center px-3 py-3">
            <Suspense
              fallback={
                <div className="h-[194px] w-full border-2 border-ink bg-slab" />
              }
            >
              <AccessByPortChart data={chartData} />
            </Suspense>
          </div>
          <CardFooter>
            <span>
              {chartData.length} 个端口 · {formatNumber(allowed + blocked)} 次样本访问
            </span>
            <span className="border border-ink bg-slab px-1.5 py-px font-bold uppercase">
              演示数据
            </span>
          </CardFooter>
        </Card>

        <Card className="flex flex-col xl:col-span-7">
          <CardHeader>
            <div>
              <Kicker>Recent blocks</Kicker>
              <CardTitle className="mt-2">最近拦截</CardTitle>
            </div>
            <span className="inline-flex items-center gap-1.5 border-2 border-ink bg-hot-pink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
              <Ban className="size-3" strokeWidth={3} />
              {recentBlocked.length} 条聚合
            </span>
          </CardHeader>

          <div className="flex-1 divide-y-2 divide-ink px-4">
            {recentBlocked.map(event => (
              <div
                key={event.id}
                className="rule-list-row flex items-center gap-3 px-2 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center border-2 border-ink bg-hot-pink text-ink">
                  <Ban className="size-4" strokeWidth={2.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <code className="block truncate font-mono text-[11px] font-bold">
                    {event.source}
                  </code>
                  <span className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                    <ProtocolTag protocol={event.protocol} />
                    端口 {event.port}
                    <span className="h-2.5 w-0.5 bg-ink" aria-hidden="true" />
                    {event.count} 次
                  </span>
                </div>
                <time className="font-mono text-[11px] font-bold">
                  {shortTime(event.time)}
                </time>
              </div>
            ))}
            {recentBlocked.length === 0 && (
              <EmptyState
                icon={<ShieldCheck className="size-6" strokeWidth={2.4} />}
                title="样本窗口内没有拦截"
                description="非白名单访问会出现在这里。"
                className="py-10"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('access')}
            className="flex items-center justify-between gap-2 border-t-2 border-ink px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors duration-150 hover:bg-acid-lime"
          >
            查看全部访问日志
            <ArrowRight className="size-4" strokeWidth={3} />
          </button>
        </Card>

        <Card className="flex flex-col xl:col-span-5">
          <CardHeader>
            <div>
              <Kicker>Recent changes</Kicker>
              <CardTitle className="mt-2">最近操作</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="查看操作日志"
              onClick={() => onNavigate('operations')}
            >
              <Clock3 className="size-4" strokeWidth={2.6} />
            </Button>
          </CardHeader>

          <div className="flex-1 px-5 py-4">
            <div className="relative">
              <span
                className="absolute bottom-2 left-[5px] top-2 w-0.5 bg-ink"
                aria-hidden="true"
              />
              {operations.slice(0, 3).map(operation => (
                <div
                  key={operation.id}
                  className="relative flex gap-3 pb-5 last:pb-0"
                >
                  <span
                    className={cn(
                      'relative z-10 mt-1 size-3 shrink-0 border-2 border-ink',
                      operation.result === '失败'
                        ? 'bg-hot-pink'
                        : 'bg-acid-lime',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="truncate font-mono text-[11px] font-bold">
                        {operation.action}
                      </strong>
                      <time className="shrink-0 font-mono text-[11px]">
                        {operation.time.slice(5, 16)}
                      </time>
                    </div>
                    <p className="mt-1 line-clamp-2 font-mono text-[12px] leading-[1.6]">
                      {operation.detail}
                    </p>
                  </div>
                </div>
              ))}
              {operations.length === 0 && (
                <p className="py-6 text-left font-mono text-[11px]">
                  还没有操作记录。
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('operations')}
            className="flex items-center justify-between gap-2 border-t-2 border-ink px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors duration-150 hover:bg-acid-lime"
          >
            查看操作日志
            <ArrowRight className="size-4" strokeWidth={3} />
          </button>
        </Card>
      </div>
    </div>
  )
}
