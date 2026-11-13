import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RotateCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useSystemRules } from '../../hooks/use-system-rules'
import type { SystemRuleCategory } from '../../bridge'
import { formatTime } from '../../data'
import { detectPlatform, platformCopy } from '../../lib/platform'
import { cn } from '../../lib/utils'
import { SearchField } from '../shared/search-field'
import { EmptyState } from '../shared/status'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Select } from '../ui/select'

const categories: Record<SystemRuleCategory, string> = {
  allow: '允许访问', block: '阻止访问', translation: '地址转换 / 端口转发', anchor: '规则入口 / Anchor', other: '其他配置',
}
const directions = { in: '入站', out: '出站', both: '双向', unknown: '未指定方向' }
const kinds = { config: '配置文件', live: '当前系统', system: '应用设置' }
const PAGE_SIZE = 30

export function SystemRules() {
  const query = useSystemRules()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(0)
  const inventory = query.data
  const rules = inventory?.rules ?? []
  const copy = platformCopy(detectPlatform(inventory?.platform))
  const sources = new Map(inventory?.sources.map(item => [item.id, item]) ?? [])
  const filtered = rules.filter(rule => {
    const text = search.trim().toLowerCase()
    return (category === 'all' || category === rule.category) && (source === 'all' || source === rule.sourceId) &&
      (!text || [rule.name, rule.ports, rule.remotePorts, rule.protocols, rule.source, rule.destination, rule.application, rule.raw, sources.get(rule.sourceId)?.label].some(value => value?.toLowerCase().includes(text)))
  })
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1))
  const windows = inventory?.platform === 'windows'
  const partial = inventory?.sources.some(item => item.status !== 'ok')

  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-3 bg-acid-lime p-4 sm:flex-row sm:items-center">
        <ShieldCheck className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-sans text-lg font-black">{inventory ? `${copy.osLabel} · 已读取 ${rules.length} 条系统规则` : '正在识别系统并读取规则'}</h2>
          <p className="mt-1 text-xs leading-relaxed">
            自动读取运行后端的电脑，按规则用途分类。系统规则为只读快照；配置文件中的规则需要另行确认是否已加载。
          </p>
          {inventory && <p className="mt-1 font-mono text-[11px]">读取时间 {formatTime(new Date(inventory.readAt * 1000))}{partial ? ' · 部分来源未能读取' : ''}{query.isError ? ' · 显示上次成功快照' : ''}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RotateCw className={cn('size-4', query.isFetching && 'animate-spin')} />
          {query.isFetching ? '读取中' : '重新读取'}
        </Button>
      </Card>

      {query.isError && <div role="alert" className="border-2 border-ink bg-tangerine p-4 text-sm">系统规则读取失败：{String(query.error.message)}。请确认本机后端正在运行后重新读取。</div>}

      {inventory && <div className="grid gap-3 sm:grid-cols-2">
        {inventory.sources.map(item => <Card key={item.id} className="min-w-0 p-3">
          <div className="flex items-start gap-2">
            {item.status === 'ok' ? <ShieldCheck className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            <div className="min-w-0 flex-1">
              <h3 className="break-all text-sm font-bold">{item.label}</h3>
              <p className="mt-1 font-mono text-[11px]">{kinds[item.kind]} · {item.status === 'ok' ? `${item.ruleCount} 条` : item.status === 'permission' ? '需要系统读取权限' : item.status === 'unsupported' ? '暂不支持' : '读取失败'}</p>
              <p className="mt-2 break-words text-xs leading-relaxed">{item.status === 'permission' ? '当前用户无权读取这部分规则。可读取的配置已列出，当前生效规则尚未确认。' : item.message}</p>
              {item.status === 'permission' && <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold">查看系统返回信息</summary><p className="mt-1 break-all">{item.message}</p></details>}
            </div>
          </div>
        </Card>)}
      </div>}

      <Card>
        <div className="flex flex-wrap gap-2 border-b-2 border-ink bg-slab p-3">
          <SearchField value={search} onChange={value => { setSearch(value); setPage(0) }} placeholder="搜索名称、端口、IP 或应用" label="搜索系统规则" className="min-w-0 flex-1 sm:min-w-[220px]" />
          <Select className="w-full sm:w-auto" aria-label="按用途分类" value={category} onChange={event => { setCategory(event.target.value); setPage(0) }}>
            <option value="all">全部用途（{rules.length}）</option>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}（{rules.filter(rule => rule.category === value).length}）</option>)}
          </Select>
          <Select className="w-full sm:max-w-[270px]" aria-label="按规则来源筛选" value={source} onChange={event => { setSource(event.target.value); setPage(0) }}>
            <option value="all">全部规则来源</option>
            {inventory?.sources.filter(item => item.ruleCount > 0).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </div>

        {query.isPending ? <div role="status" className="flex items-center justify-center gap-2 p-10 text-sm"><Loader2 className="size-5 animate-spin" />正在读取系统防火墙…</div> : filtered.length === 0 ? <EmptyState
          icon={<ShieldCheck />} title={rules.length ? '没有符合筛选条件的规则' : partial ? '可读取来源中暂无规则' : query.isError ? '尚未读取系统规则' : '当前未读取到系统规则'}
          description={rules.length ? '调整用途、来源或搜索条件。' : partial ? '部分来源读取失败，请查看上方读取状态。' : '读取范围及防火墙状态见上方。系统规则不会自动加入应用白名单。'}
        /> : <div className="divide-y-2 divide-ink">
          {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(rule => <article key={rule.id} className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('border-2 border-ink px-2 py-0.5 text-xs font-bold', rule.category === 'allow' ? 'bg-acid-lime' : rule.category === 'block' ? 'bg-tangerine' : 'bg-slab')}>{categories[rule.category]}</span>
              <h3 className="min-w-0 break-all text-base font-black">{rule.name}</h3>
              <span className="text-xs">{directions[rule.direction]}</span>
              {rule.enabled !== null && <span className="border border-ink px-1 text-xs">{rule.enabled ? '规则已启用' : '规则已停用'}</span>}
              <span className="text-xs font-bold sm:ml-auto">{kinds[sources.get(rule.sourceId)?.kind ?? 'config']} · 只读</span>
            </div>
            <p className="mt-2 break-all font-mono text-[11px]">{sources.get(rule.sourceId)?.label}</p>
            {rule.category !== 'anchor' && rule.category !== 'other' && <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
              <Field label="协议" value={protocolName(rule.protocols)} />
              <Field label={windows ? '本机端口' : '目标端口'} value={rule.ports} />
              <Field label={windows ? '远端地址' : '来源地址'} value={rule.source} />
              <Field label={windows ? '本机地址' : '目标地址'} value={rule.destination} />
              {rule.remotePorts && <Field label={windows ? '远端端口' : '来源端口'} value={rule.remotePorts} />}
              {rule.application && <Field label="应用" value={rule.application} />}
            </dl>}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-bold">查看原始规则与限定条件</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all border-2 border-ink bg-slab p-3 font-mono text-[11px] leading-relaxed">{rule.raw}</pre>
            </details>
          </article>)}
        </div>}
        {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink p-3 text-xs">
          <span>共 {filtered.length} 条 · 第 {currentPage + 1} / {Math.ceil(filtered.length / PAGE_SIZE)} 页</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" aria-label="上一页" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" />上一页</Button>
            <Button size="sm" variant="ghost" aria-label="下一页" disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" />下一页</Button>
          </div>
        </div>}
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="font-bold">{label}</dt><dd className="mt-0.5 break-all font-mono">{value || '未指定（见原始规则）'}</dd></div>
}

function protocolName(value: string) {
  return value.split(',').map(part => ({ '6': 'TCP', '17': 'UDP', '1': 'ICMP', '58': 'ICMPv6', '256': 'Any' }[part.trim()] ?? part)).join(', ')
}
