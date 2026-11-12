import {
  ArrowUpDown,
  Ban,
  CircleCheck,
  Globe2,
  Monitor,
  Network,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { protocolLabel } from '../data'
import type { Rule } from '../data'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import { PageHeader } from '../components/shared/page-header'
import { SearchField } from '../components/shared/search-field'
import { Segmented } from '../components/shared/segmented'
import { EmptyState, ProtocolTag, StatePill } from '../components/shared/status'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Switch } from '../components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip'

type Props = {
  onNew: () => void
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
  onToggle: (rule: Rule) => void
}

type Filter = 'all' | 'enabled' | 'disabled'

export default function Rules({ onNew, onEdit, onDelete, onToggle }: Props) {
  const rules = useAppStore(state => state.rules)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [ascending, setAscending] = useState(true)

  const active = rules.filter(rule => rule.enabled).length
  const uniqueSources = new Set(
    rules.flatMap(rule => rule.sources.map(source => source.address)),
  ).size
  const tcpCount = rules.filter(rule => rule.protocols.includes('tcp')).length
  const udpCount = rules.filter(rule => rule.protocols.includes('udp')).length

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return rules
      .filter(
        rule =>
          filter === 'all' ||
          (filter === 'enabled' ? rule.enabled : !rule.enabled),
      )
      .filter(rule => {
        if (!search) return true
        return (
          rule.name.toLowerCase().includes(search) ||
          String(rule.port).includes(search) ||
          rule.sources.some(
            source =>
              source.address.toLowerCase().includes(search) ||
              source.label.toLowerCase().includes(search),
          )
        )
      })
      .sort((a, b) => (ascending ? a.port - b.port : b.port - a.port))
  }, [rules, filter, query, ascending])

  const hasFilters = query.trim() !== '' || filter !== 'all'

  return (
    <div>
      <PageHeader
        title="端口规则"
        description="每个规则管理一个本机端口，只有名单内的来源能够访问。未配置的端口不受影响。"
        actions={
          <Button onClick={onNew}>
            <Plus className="size-4" />
            新建规则
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
            <ShieldCheck className="size-[18px]" />
          </span>
          <div>
            <div className="num text-[19px] font-semibold leading-none">
              {active}{' '}
              <span className="text-[11px] font-normal text-muted-foreground">
                / {rules.length}
              </span>
            </div>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              规则正在生效
            </span>
          </div>
        </div>

        <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />

        <Stat label="白名单来源" value={uniqueSources} />
        <Stat label="TCP 规则" value={tcpCount} />
        <Stat label="UDP 规则" value={udpCount} />

        <p className="ml-auto hidden items-center gap-1.5 text-[10px] text-muted-foreground xl:flex">
          <Globe2 className="size-3.5" />
          IPv4 与 IPv6 来源都会被覆盖
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-border/70 p-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="搜索名称、端口或来源 IP"
            label="搜索规则"
            className="sm:max-w-[280px]"
          />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Segmented
              value={filter}
              onChange={setFilter}
              ariaLabel="按状态筛选"
              options={[
                { value: 'all', label: '全部', count: rules.length },
                { value: 'enabled', label: '生效中', count: active },
                { value: 'disabled', label: '已停用', count: rules.length - active },
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAscending(current => !current)}
            >
              <ArrowUpDown className="size-3.5" />
              端口{ascending ? '升序' : '降序'}
            </Button>
          </div>
        </div>

        <div className="hidden grid-cols-[92px_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-4 border-b border-border/60 bg-muted/30 px-5 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid">
          <span>端口 / 规则</span>
          <span>名称与更新</span>
          <span>允许来源</span>
          <span className="text-right">状态与操作</span>
        </div>

        <div>
          {filtered.map(rule => (
            <article
              key={rule.id}
              className={cn(
                'group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b border-border/60 px-4 py-3.5 transition-colors last:border-0 hover:bg-muted/35 md:grid-cols-[92px_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-5',
                !rule.enabled && 'bg-muted/20',
              )}
            >
              <div className="md:col-auto">
                <span className="num font-mono text-[17px] font-semibold leading-none">
                  {rule.port}
                </span>
                <div className="mt-1 flex gap-1">
                  {rule.protocols.map(protocol => (
                    <ProtocolTag key={protocol} protocol={protocol} />
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[13px] font-medium">
                    {rule.name}
                  </h2>
                  <StatePill enabled={rule.enabled} />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  <span>更新于 {rule.updatedAt.slice(5, 16)}</span>
                  <i className="h-2.5 w-px bg-border" aria-hidden="true" />
                  <span>{protocolLabel(rule.protocols)} · 入站</span>
                  <i className="h-2.5 w-px bg-border" aria-hidden="true" />
                  <span>{rule.sources.length} 个来源</span>
                </p>
              </div>

              <div className="col-span-3 flex flex-wrap items-center gap-1 md:col-span-1">
                {rule.sources.slice(0, 2).map(source => (
                  <span
                    key={source.address}
                    className="inline-flex max-w-[190px] items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    title={`${source.label} · ${source.address}`}
                  >
                    {source.address.includes('/') ? (
                      <Globe2 className="size-2.5 shrink-0" />
                    ) : (
                      <Monitor className="size-2.5 shrink-0" />
                    )}
                    <span className="truncate">{source.address}</span>
                  </span>
                ))}
                {rule.sources.length > 2 && (
                  <span
                    className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    title={rule.sources
                      .slice(2)
                      .map(source => source.address)
                      .join('\n')}
                  >
                    +{rule.sources.length - 2}
                  </span>
                )}
                {rule.sources.length === 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#f0dfbb] bg-warning-soft/70 px-1.5 py-0.5 text-[10px] text-warning">
                    <Ban className="size-3" />
                    拒绝所有来源
                  </span>
                )}
              </div>

              <div className="col-start-3 row-start-1 flex items-center gap-1 md:col-auto md:row-auto">
                <span className="mr-1 hidden text-[10px] text-muted-foreground lg:inline">
                  {rule.enabled ? '已启用' : '已停用'}
                </span>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => onToggle(rule)}
                  aria-label={`${rule.enabled ? '停用' : '启用'} ${rule.name}`}
                />
                <div className="ml-1 flex items-center gap-0.5 border-l border-border pl-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 text-muted-foreground hover:text-foreground md:size-7"
                        onClick={() => onEdit(rule)}
                        aria-label={`编辑 ${rule.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>编辑规则</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 text-muted-foreground hover:bg-destructive-soft hover:text-destructive md:size-7"
                        onClick={() => onDelete(rule)}
                        aria-label={`删除 ${rule.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>删除规则</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={
              hasFilters ? (
                <Search className="size-5" />
              ) : (
                <Network className="size-5" />
              )
            }
            title={
              rules.length === 0 ? '还没有端口规则' : '没有匹配的规则'
            }
            description={
              rules.length === 0
                ? '创建第一条规则，开始管理本机端口。'
                : '换一个关键词，或把筛选条件改回“全部”。'
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                >
                  <CircleCheck className="size-3.5" />
                  清除筛选
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={onNew}>
                  <Plus className="size-3.5" />
                  新建规则
                </Button>
              )
            }
          />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 text-[10.5px] text-muted-foreground sm:px-5">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0" />
            停用或删除只撤除本软件的规则，对应端口回到系统原有策略。
          </span>
          <span className="font-mono text-[10px]">
            {filtered.length} / {rules.length} 条规则
          </span>
        </footer>
      </Card>

      <div className="mt-3 flex gap-2.5 rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
        <Network className="mt-0.5 size-3.5 shrink-0" />
        <p>
          <strong className="font-medium text-foreground">
            规则之间取并集。
          </strong>
          同一个 IP 命中任意一条来源就属于白名单；删除单独条目后，若仍被某个
          CIDR 网段覆盖，它依然可以访问。
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="num text-[16px] font-semibold leading-none">{value}</div>
      <span className="mt-1 block text-[10px] text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
