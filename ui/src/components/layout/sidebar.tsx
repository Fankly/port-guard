import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowUpRight,
  History,
  LayoutDashboard,
  Network,
  ScrollText,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import type { PageId } from '../../hooks/use-route'
import { cn } from '../../lib/utils'
import { LiveDot } from '../shared/status'

type NavItem = {
  id: PageId
  label: string
  icon: typeof LayoutDashboard
  badge?: number
  danger?: boolean
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: '工作区',
    items: [
      { id: 'overview', label: '总览', icon: LayoutDashboard },
      { id: 'rules', label: '端口规则', icon: Network },
      { id: 'access', label: '访问日志', icon: ScrollText },
      { id: 'operations', label: '操作日志', icon: History },
    ],
  },
  {
    label: '系统',
    items: [{ id: 'settings', label: '设置', icon: Settings }],
  },
]

export function Sidebar({
  page,
  activeCount,
  blockedCount,
  desktop,
  storageError,
  onNavigate,
}: {
  page: PageId
  activeCount: number
  blockedCount: number
  desktop: boolean
  storageError: boolean
  onNavigate: (page: PageId) => void
}) {
  const reduceMotion = useReducedMotion()

  const navGroups = groups.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      badge:
        item.id === 'rules'
          ? activeCount
          : item.id === 'access'
            ? blockedCount
            : undefined,
      danger: item.id === 'access' && blockedCount > 0,
    })),
  }))

  return (
    <aside data-sidebar className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-white/[0.06] bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-linear-to-br from-[#1d926c] to-[#0b5943] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_-8px_rgba(16,120,88,0.9)]">
          <ShieldCheck className="size-[18px] text-white" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <strong className="block text-[14px] font-semibold tracking-[-0.01em] text-white">
            Port Guard
          </strong>
          <span className="block text-[10.5px] tracking-wide text-sidebar-muted">
            本机端口白名单
          </span>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3" aria-label="主导航">
        {navGroups.map(group => (
          <div className="mb-5" key={group.label}>
            <p className="mb-1.5 px-2.5 text-[9.5px] font-medium uppercase tracking-[0.16em] text-sidebar-muted/80">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon
                const active = page === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[12.5px] outline-none transition-colors duration-150',
                      active
                        ? 'text-white'
                        : 'text-sidebar-foreground/70 hover:bg-white/[0.04] hover:text-sidebar-foreground',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-[9px] bg-white/[0.075] ring-1 ring-inset ring-white/[0.06]"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 420, damping: 34 }
                        }
                      />
                    )}
                    <Icon
                      className={cn(
                        'relative size-[17px] shrink-0',
                        active
                          ? 'text-emerald-300'
                          : 'text-sidebar-muted group-hover:text-sidebar-foreground/80',
                      )}
                      strokeWidth={1.9}
                    />
                    <span className="relative flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={cn(
                          'relative rounded-full px-1.5 py-px font-mono text-[9.5px] tabular-nums',
                          item.danger
                            ? 'bg-[#c2604a]/15 text-[#e9a898]'
                            : 'bg-white/[0.07] text-sidebar-muted',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-xl border border-sidebar-border bg-white/[0.035] p-3">
          <div className="flex items-center gap-2">
            {activeCount > 0 ? (
              <LiveDot />
            ) : (
              <span className="size-1.5 rounded-full bg-[#c08a35]" aria-hidden="true" />
            )}
            <span className="text-[11.5px] font-medium text-white/85">
              {activeCount > 0 ? '防护运行中' : '防护已暂停'}
            </span>
            <span className="ml-auto rounded-full border border-white/10 px-1.5 py-px text-[9px] text-sidebar-muted">
              示例
            </span>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-sidebar-muted">
            {activeCount > 0
              ? `${activeCount} 个端口按白名单管理，日志采集正常。`
              : '暂无启用中的规则，端口保持系统原有策略。'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-emerald-300/90 transition-colors hover:text-emerald-200"
          >
            查看运行状态
            <ArrowUpRight className="size-3" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2.5 px-1">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-mono text-[10px] font-semibold text-white/75">
            M
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[11.5px] text-white/85">
              这台 Mac
            </strong>
            <span className="block truncate text-[10px] text-sidebar-muted">
              macOS ·{' '}
              {storageError
                ? '本机存储异常'
                : desktop
                  ? 'SQLite 已连接'
                  : '本地预览'}
            </span>
          </div>
          <span className="font-mono text-[9.5px] text-sidebar-muted/80">
            v0.1.0
          </span>
        </div>
      </div>
    </aside>
  )
}
