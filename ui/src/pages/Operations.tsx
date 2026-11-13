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
        label="Operations / 操作"
        title="操作日志"
        description="记录规则创建、修改、启停与设置变更，便于排查“什么时候改过什么”。"
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <ArrowDownToLine className="size-4" strokeWidth={3} />
            导出 CSV
          </Button>
        }
      />

      <Card className="mb-6 grid border-2 shadow-[8px_8px_0_0_#000] sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1.4fr]">
        <Summary
          icon={<History className="size-5" strokeWidth={2.6} />}
          value={operations.length}
          label="条操作记录"
          tone="dark"
        />
        <Summary
          icon={<CircleCheck className="size-5" strokeWidth={2.6} />}
          value={operations.filter(operation => operation.result === '成功').length}
          label="次执行成功"
          tone="lime"
        />
        <Summary
          icon={<Clock3 className="size-5" strokeWidth={2.6} />}
          value={todayCount}
          label="今天发生"
        />
        <div className="flex flex-col justify-center gap-2 border-t-2 border-ink px-4 py-4 sm:col-span-2 lg:col-span-1 lg:border-l-2 lg:border-t-0">
          <span className="inline-flex w-fit items-center gap-1.5 border-2 border-ink bg-acid-lime px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
            <span className="size-1.5 bg-ink" />
            记录完整
          </span>
          <p className="font-mono text-[11px] leading-[1.6]">
            最近一次变更：
            {operations[0]
              ? `${operations[0].action} · ${operations[0].time.slice(5, 16)}`
              : '—'}
          </p>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b-2 border-ink bg-slab p-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="搜索操作、说明或端口"
            label="搜索操作日志"
            className="sm:max-w-[300px]"
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

        <div className="px-4 py-3 sm:px-5">
          {days.map(day => {
            const items = filtered.filter(operation =>
              operation.time.startsWith(day),
            )
            return (
              <section key={day} className="py-3">
                <header className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
                  <h2 className="font-sans text-[18px] font-black tracking-[-0.02em]">
                    {friendlyDay(day)}
                  </h2>
                  <span className="border border-ink bg-paper px-1.5 py-px font-mono text-[11px] font-bold">
                    {items.length} 条记录
                  </span>
                </header>

                <div className="relative">
                  <span
                    className="absolute bottom-3 left-[19px] top-3 w-0.5 bg-ink"
                    aria-hidden="true"
                  />
                  {items.map(operation => {
                    const Icon = operationIcon(operation.action)
                    const failed = operation.result === '失败'
                    return (
                      <div
                        key={operation.id}
                        className="group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 py-3 transition-colors duration-150 hover:bg-slab sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                      >
                        <span
                          className={cn(
                            'relative z-10 grid size-10 shrink-0 place-items-center border-2 border-ink',
                            failed
                              ? 'bg-hot-pink text-ink'
                              : 'bg-acid-lime text-ink',
                          )}
                        >
                          <Icon className="size-4" strokeWidth={2.6} />
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <strong className="font-sans text-[16px] font-black leading-tight">
                              {operation.action}
                            </strong>
                            {operation.port !== undefined && (
                              <span className="border border-ink bg-paper px-1.5 py-px font-mono text-[11px] font-bold">
                                端口 {operation.port}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 font-mono text-[12px] leading-[1.6]">
                            {operation.detail}
                          </p>
                        </div>

                        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-auto sm:flex-col sm:items-end sm:gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 border-2 border-ink px-1.5 py-px font-mono text-[11px] font-bold uppercase',
                              failed
                                ? 'bg-hot-pink text-ink'
                                : 'bg-electric-cyan text-ink',
                            )}
                          >
                            {failed ? (
                              <CircleX className="size-2.5" strokeWidth={3} />
                            ) : (
                              <CircleCheck className="size-2.5" strokeWidth={3} />
                            )}
                            {operation.result}
                          </span>
                          <code className="font-mono text-[11px] font-bold">
                            {shortTime(operation.time)}
                          </code>
                          <span className="hidden font-mono text-[11px] sm:block">
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
            icon={<History className="size-6" strokeWidth={2.4} />}
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
                <CircleCheck className="size-3.5" strokeWidth={3} />
                清除筛选
              </Button>
            }
          />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink bg-slab px-4 py-3 font-mono text-[11px] sm:px-5">
          <span className="font-bold">共 {filtered.length} 条记录 · 最多保留最近 100 条</span>
          <span className="inline-flex items-center gap-1.5 border border-ink bg-tangerine px-1.5 py-px font-bold">
            <span className="size-1.5 bg-ink" />
            界面演示样本
          </span>
        </footer>
      </Card>

      <div className="mt-6 flex gap-3 border-2 border-ink bg-paper px-4 py-3.5 shadow-[4px_4px_0_0_#000]">
        <History className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
        <p className="font-mono text-[12px] leading-[1.7]">
          <strong className="font-bold">日志是界面预览的一部分。</strong>
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
  tone?: 'dark' | 'lime'
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b-2 border-ink px-4 py-4 last:border-b-0 sm:border-r-2 sm:last:border-r-0 lg:border-b-0',
        tone === 'dark' && 'bg-ink text-paper',
        tone === 'lime' && 'bg-acid-lime text-ink',
      )}
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center border-2',
          tone === 'dark'
            ? 'border-paper bg-paper text-ink'
            : 'border-ink bg-paper text-ink',
        )}
      >
        {icon}
      </span>
      <div>
        <div className="num font-sans text-[30px] font-black leading-[0.9]">
          {value}
        </div>
        <span className="mt-1 block font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>
    </div>
  )
}
