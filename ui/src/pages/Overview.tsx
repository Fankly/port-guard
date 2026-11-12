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
    <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  )
}

export default function Overview({ onNavigate, onNewRule, onToggle }: Props) {
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
        title={`${greeting()}，这里是本机端口概览`}
        description={
          <>
            {today} · 只把受管端口开放给名单内的来源，其余端口保持系统原有策略。
          </>
        }
        actions={
          <Button onClick={onNewRule}>
            <Plus className="size-4" />
            新建规则
          </Button>
        }
      />

      <section data-dark-surface className="relative overflow-hidden rounded-2xl bg-sidebar text-white shadow-[0_28px_70px_-46px_rgba(8,30,20,0.9)]">
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-28 -top-40 size-[440px] rounded-full bg-[radial-gradient(circle,rgba(32,170,126,0.32),transparent_66%)]" />
        <ShieldCheck
          className="pointer-events-none absolute -bottom-16 -right-10 size-64 text-white/[0.03]"
          strokeWidth={0.8}
          aria-hidden="true"
        />

        <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.35fr_0.9fr] lg:items-end lg:gap-10">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/70">
              <LiveDot />
              防护运行中
              <span className="h-3 w-px bg-white/15" aria-hidden="true" />
              <span className="text-white/50">PF 引擎 · 本机模式</span>
            </span>

            <h2 className="mt-4 text-[25px] font-semibold leading-[1.3] tracking-[-0.025em] sm:text-[30px]">
              {hasActiveRules ? (
                <>
                  只放行名单内的设备，
                  <br className="hidden sm:block" />
                  其余访问留在门外。
                </>
              ) : (
                <>
                  规则已暂停，
                  <br className="hidden sm:block" />
                  端口暂时处于未管理状态。
                </>
              )}
            </h2>

            <p className="mt-2.5 max-w-[470px] text-[12px] leading-relaxed text-white/55">
              {hasActiveRules ? (
                <>
                  {activeRules.length} 个端口正在按白名单工作，样本窗口内已放行{' '}
                  <strong className="font-medium text-white/85">
                    {formatNumber(allowed)}
                  </strong>{' '}
                  次访问、拦截{' '}
                  <strong className="font-medium text-white/85">
                    {formatNumber(blocked)}
                  </strong>{' '}
                  次访问。
                </>
              ) : (
                <>启用任意一条规则后，只有白名单内的来源可以访问对应端口。</>
              )}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="bg-white text-sidebar shadow-none hover:bg-white/90"
                onClick={() => onNavigate('rules')}
              >
                管理端口规则
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.09] hover:text-white"
                onClick={() => onNavigate('access')}
              >
                <ScrollText className="size-3.5" />
                查看访问日志
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl border border-white/[0.09] bg-white/[0.045] p-1 backdrop-blur-sm">
            <div className="px-3 py-3 sm:px-4">
              <span className="block text-[10px] text-white/55">生效规则</span>
              <strong className="num mt-1 block text-[24px] font-semibold leading-none">
                {String(activeRules.length).padStart(2, '0')}
              </strong>
              <small className="mt-1.5 block text-[10px] text-white/50">
                {rules.length - activeRules.length} 条已停用
              </small>
            </div>
            <div className="px-3 py-3 sm:px-4">
              <span className="block text-[10px] text-white/55">白名单来源</span>
              <strong className="num mt-1 block text-[24px] font-semibold leading-none">
                {String(uniqueSources.size).padStart(2, '0')}
              </strong>
              <small className="mt-1.5 block text-[10px] text-white/50">
                IP + CIDR 去重
              </small>
            </div>
            <div className="px-3 py-3 sm:px-4">
              <span className="block text-[10px] text-white/55">样本拦截</span>
              <strong className="num mt-1 block text-[24px] font-semibold leading-none">
                {formatNumber(blocked)}
              </strong>
              <small className="mt-1.5 block text-[10px] text-white/50">
                来自 {blockedSources.size} 个来源
              </small>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="flex flex-col xl:col-span-7">
          <CardHeader>
            <div>
              <Kicker>Active ports</Kicker>
              <CardTitle className="mt-1">受保护端口</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 text-muted-foreground"
              onClick={() => onNavigate('rules')}
            >
              全部规则
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>

          <div className="flex-1 px-3 py-2">
            {activeRules.map(rule => (
              <div
                key={rule.id}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/45"
              >
                <div className="w-14 shrink-0 rounded-lg border border-border bg-muted/50 px-1 py-1 text-center">
                  <div className="font-mono text-[15px] font-semibold leading-tight tracking-tight">
                    {rule.port}
                  </div>
                  <div className="font-mono text-[8.5px] text-muted-foreground">
                    {protocolLabel(rule.protocols)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-[12.5px] font-medium">
                      {rule.name}
                    </strong>
                    <StatePill
                      enabled
                      className="hidden sm:inline-flex"
                    />
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                    {rule.sources.length} 个来源
                    {rule.sources.length > 0 && (
                      <span className="text-muted-foreground">
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
                icon={<ShieldCheck className="size-5" />}
                title="还没有启用中的端口规则"
                description="新建规则后，受管端口将只允许名单内来源访问。"
                action={
                  <Button variant="secondary" size="sm" onClick={onNewRule}>
                    <Plus className="size-3.5" />
                    新建规则
                  </Button>
                }
                className="py-10"
              />
            )}
          </div>

          <CardFooter className="text-[10.5px]">
            <span className="flex items-center gap-1.5">
              <Network className="size-3.5 shrink-0" />
              未在列表中的端口不受本软件影响，保持系统防火墙原有行为。
            </span>
          </CardFooter>
        </Card>

        <Card className="flex flex-col xl:col-span-5">
          <CardHeader>
            <div>
              <Kicker>Sample window</Kicker>
              <CardTitle className="mt-1">访问分布</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                按目标端口聚合 · 样本数据
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-chart-allow" />
                放行
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-chart-block" />
                拦截
              </span>
            </div>
          </CardHeader>
          <div className="flex flex-1 items-center px-3 py-1">
            <Suspense
              fallback={
                <div className="h-[194px] animate-pulse rounded-lg bg-muted/50" />
              }
            >
              <AccessByPortChart data={chartData} />
            </Suspense>
          </div>
          <CardFooter className="text-[10.5px]">
            <span>{chartData.length} 个端口 · {formatNumber(allowed + blocked)} 次样本访问</span>
            <span className="text-muted-foreground">演示数据</span>
          </CardFooter>
        </Card>

        <Card className="flex flex-col xl:col-span-7">
          <CardHeader>
            <div>
              <Kicker>Recent blocks</Kicker>
              <CardTitle className="mt-1">最近拦截</CardTitle>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f1d5cf] bg-destructive-soft/70 px-2 py-0.5 text-[10px] font-medium text-destructive">
              <Ban className="size-3" />
              {recentBlocked.length} 条聚合
            </span>
          </CardHeader>

          <div className="flex-1 px-3 py-1.5">
            {recentBlocked.map(event => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/45"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive-soft/80 text-destructive">
                  <Ban className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <code className="block truncate font-mono text-[11.5px] font-medium">
                    {event.source}
                  </code>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <ProtocolTag protocol={event.protocol} />
                    端口 {event.port}
                    <span className="h-2.5 w-px bg-border" aria-hidden="true" />
                    {event.count} 次
                  </span>
                </div>
                <time className="font-mono text-[10px] text-muted-foreground">
                  {shortTime(event.time)}
                </time>
              </div>
            ))}
            {recentBlocked.length === 0 && (
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="样本窗口内没有拦截"
                description="非白名单访问会出现在这里。"
                className="py-10"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('access')}
            className="flex items-center justify-between gap-2 border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            查看全部访问日志
            <ArrowRight className="size-3.5" />
          </button>
        </Card>

        <Card className="flex flex-col xl:col-span-5">
          <CardHeader>
            <div>
              <Kicker>Recent changes</Kicker>
              <CardTitle className="mt-1">最近操作</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="查看操作日志"
              onClick={() => onNavigate('operations')}
            >
              <Clock3 className="size-4" />
            </Button>
          </CardHeader>

          <div className="flex-1 px-5 py-3">
            <div className="relative">
              <span
                className="absolute bottom-2 left-[5px] top-2 w-px bg-border"
                aria-hidden="true"
              />
              {operations.slice(0, 3).map(operation => (
                <div
                  key={operation.id}
                  className="relative flex gap-3 pb-4 last:pb-0"
                >
                  <span
                    className={cn(
                      'relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2 border-card',
                      operation.result === '失败'
                        ? 'bg-destructive'
                        : 'bg-primary',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="truncate text-[11.5px] font-medium">
                        {operation.action}
                      </strong>
                      <time className="shrink-0 font-mono text-[9.5px] text-muted-foreground">
                        {operation.time.slice(5, 16)}
                      </time>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">
                      {operation.detail}
                    </p>
                  </div>
                </div>
              ))}
              {operations.length === 0 && (
                <p className="py-6 text-center text-[11px] text-muted-foreground">
                  还没有操作记录。
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('operations')}
            className="flex items-center justify-between gap-2 border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            查看操作日志
            <ArrowRight className="size-3.5" />
          </button>
        </Card>
      </div>
    </div>
  )
}
