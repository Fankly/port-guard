import {
  ArrowDownToLine,
  CircleCheck,
  CircleX,
  Clock3,
  History,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Settings,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { downloadFile, formatTime, friendlyDay, shortTime, toCsv } from '../data'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/app-store'
import { PageHeader } from '../components/shared/page-header'
import { SearchField } from '../components/shared/search-field'
import { Segmented } from '../components/shared/segmented'
import { EmptyState } from '../components/shared/status'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

type Filter = 'all' | 'rules' | 'service'

function operationIcon(action: string) {
  if (action.includes('创建')) return Plus
  if (action.includes('删除')) return Trash2
  if (action.includes('停用') || action.includes('启用')) return Power
  if (action.includes('恢复')) return RotateCcw
  if (action.includes('设置')) return Settings
  return Pencil
}

function isService(action: string): boolean {
  return (
    action.includes('设置') ||
    action.includes('服务') ||
    action.includes('恢复')
  )
}

export default function Operations() {
  const operations = useAppStore(state => state.operations)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return operations
      .filter(
        operation =>
          filter === 'all' ||
          (filter === 'rules'
            ? !isService(operation.action)
            : isService(operation.action)),
      )
      .filter(
        operation =>
          !search ||
          operation.action.toLowerCase().includes(search) ||
          operation.detail.toLowerCase().includes(search) ||
          (operation.port !== undefined &&
            String(operation.port).includes(search)),
      )
      .slice()
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [operations, query, filter])

  const days = [...new Set(filtered.map(operation => operation.time.slice(0, 10)))]
  const today = formatTime().slice(0, 10)
  const todayCount = operations.filter(operation =>
    operation.time.startsWith(today),
  ).length

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['时间', '操作', '详情', '端口', '结果'],
      ...filtered.map(operation => [
        operation.time,
        operation.action,
        operation.detail,
        operation.port ?? '',
        operation.result,
      ]),
    ]
    downloadFile(
      `port-guard-operations-${today}.csv`,
      `\uFEFF${toCsv(rows)}`,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div>
      <PageHeader
        title="操作日志"
        description="记录规则创建、修改、启停与设置变更，便于排查“什么时候改过什么”。"
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <ArrowDownToLine className="size-3.5" />
            导出 CSV
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
        <Summary
          icon={<History className="size-[17px]" />}
          value={operations.length}
          label="条操作记录"
        />
        <Summary
          icon={<CircleCheck className="size-[17px]" />}
          value={operations.filter(operation => operation.result === '成功').length}
          label="次执行成功"
          tone="green"
        />
        <Summary
          icon={<Clock3 className="size-[17px]" />}
          value={todayCount}
          label="今天发生"
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe6da] bg-[#eff8f2] px-2 py-0.5 text-[10px] font-medium text-[#0e6a4e]">
            <span className="size-1.5 rounded-full bg-[#1e8b66]" />
            记录完整
          </span>
          <p className="hidden text-[10px] text-muted-foreground xl:block">
            最近一次变更：
            {operations[0]
              ? `${operations[0].action} · ${operations[0].time.slice(5, 16)}`
              : '—'}
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-border/70 p-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="搜索操作、说明或端口"
            label="搜索操作日志"
            className="sm:max-w-[280px]"
          />
          <div className="sm:ml-auto">
            <Segmented
              value={filter}
              onChange={setFilter}
              ariaLabel="按类型筛选"
              options={[
                { value: 'all', label: '全部' },
                { value: 'rules', label: '规则变更' },
                { value: 'service', label: '服务设置' },
              ]}
            />
          </div>
        </div>

        <div className="px-4 py-2 sm:px-5">
          {days.map(day => {
            const items = filtered.filter(operation =>
              operation.time.startsWith(day),
            )
            return (
              <section key={day} className="py-3">
                <header className="mb-2.5 flex items-baseline justify-between gap-3">
                  <h2 className="text-[12px] font-semibold tracking-[-0.01em]">
                    {friendlyDay(day)}
                  </h2>
                  <span className="font-mono text-[9.5px] text-muted-foreground">
                    {items.length} 条记录
                  </span>
                </header>

                <div className="relative">
                  <span
                    className="absolute bottom-3 left-[15px] top-3 w-px bg-border"
                    aria-hidden="true"
                  />
                  {items.map(operation => {
                    const Icon = operationIcon(operation.action)
                    const failed = operation.result === '失败'
                    return (
                      <div
                        key={operation.id}
                        className="group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3.5"
                      >
                        <span
                          className={cn(
                            'relative z-10 grid size-8 shrink-0 place-items-center rounded-lg border bg-card shadow-xs',
                            failed
                              ? 'border-[#f1d5cf] text-destructive'
                              : 'border-border text-muted-foreground group-hover:text-primary',
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <strong className="text-[12px] font-medium">
                              {operation.action}
                            </strong>
                            {operation.port !== undefined && (
                              <span className="rounded border border-border bg-muted/50 px-1.5 py-px font-mono text-[9.5px] text-muted-foreground">
                                端口 {operation.port}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">
                            {operation.detail}
                          </p>
                        </div>

                        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-auto sm:flex-col sm:items-end sm:gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[9.5px]',
                              failed
                                ? 'border-[#f1d5cf] bg-destructive-soft/70 text-destructive'
                                : 'border-[#cfe6da] bg-[#eff8f2] text-[#0e6a4e]',
                            )}
                          >
                            {failed ? (
                              <CircleX className="size-2.5" />
                            ) : (
                              <CircleCheck className="size-2.5" />
                            )}
                            {operation.result}
                          </span>
                          <code className="font-mono text-[9.5px] text-muted-foreground">
                            {shortTime(operation.time)}
                          </code>
                          <span className="hidden text-[9.5px] text-muted-foreground sm:block">
                            本机管理员
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={<History className="size-5" />}
            title="没有匹配的操作记录"
            description="换一个关键词，或把类型筛选改回“全部”。"
            action={
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
            }
          />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 text-[10.5px] text-muted-foreground sm:px-5">
          <span>共 {filtered.length} 条记录 · 最多保留最近 100 条</span>
          <span className="flex items-center gap-1.5 text-warning">
            <span className="size-1.5 rounded-full bg-[#c08a35]" />
            界面演示样本
          </span>
        </footer>
      </Card>

      <div className="mt-3 flex gap-2.5 rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
        <History className="mt-0.5 size-3.5 shrink-0" />
        <p>
          <strong className="font-medium text-foreground">
            日志是界面预览的一部分。
          </strong>
          真正接入后台服务后，操作结果会由执行层返回，失败原因也会保留在这里，不用“配置已保存”代替“规则已生效”。
        </p>
      </div>
    </div>
  )
}

function Summary({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode
  value: number
  label: string
  tone?: 'green'
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid size-8 place-items-center rounded-lg',
          tone === 'green'
            ? 'bg-primary-soft text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <div>
        <div className="num text-[16px] font-semibold leading-none">{value}</div>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}
