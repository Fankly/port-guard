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
import type { PlatformId } from '../../lib/platform'
import { platformCopy } from '../../lib/platform'
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
    label: 'Work / 工作区',
    items: [
      { id: 'overview', label: '总览', icon: LayoutDashboard },
      { id: 'rules', label: '端口规则', icon: Network },
      { id: 'access', label: '访问日志', icon: ScrollText },
      { id: 'operations', label: '操作日志', icon: History },
    ],
  },
  {
    label: 'System / 系统',
    items: [{ id: 'settings', label: '设置', icon: Settings }],
  },
]

export function Sidebar({
  page,
  activeCount,
  blockedCount,
  desktop,
  storageError,
  platform,
  onNavigate,
}: {
  page: PageId
  activeCount: number
  blockedCount: number
  desktop: boolean
  storageError: boolean
  platform: PlatformId
  onNavigate: (page: PageId) => void
}) {
  const platformLabels = platformCopy(platform)
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
    <aside
      data-sidebar
      className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r-4 border-ink bg-sidebar text-sidebar-foreground lg:flex"
    >
      <div className="flex items-center gap-3 border-b-2 border-paper px-5 pb-5 pt-5">
        <span className="grid size-10 shrink-0 place-items-center border-2 border-paper bg-acid-lime text-ink shadow-[4px_4px_0_0_#ffffff]">
          <ShieldCheck className="size-5" strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <strong className="block font-sans text-[17px] font-black uppercase leading-none tracking-[-0.02em] text-paper">
            Port Guard
          </strong>
          <span className="mt-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-paper">
            本机端口白名单
          </span>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="主导航">
        {navGroups.map(group => (
          <div className="mb-6" key={group.label}>
            <p className="mb-2 border-b border-paper px-2 pb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-paper">
              {group.label}
            </p>
            <div className="space-y-1.5">
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
                      'group flex h-10 w-full items-center gap-3 border-2 px-2.5 text-left font-mono text-[12px] font-bold uppercase tracking-[0.04em] transition-all duration-150',
                      active
                        ? 'translate-x-1 border-paper bg-acid-lime text-ink shadow-[4px_4px_0_0_#ffffff]'
                        : 'border-transparent text-paper hover:border-paper hover:bg-paper hover:text-ink',
                    )}
                  >
                    <Icon
                      className="size-4 shrink-0"
                      strokeWidth={active ? 2.8 : 2.2}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={cn(
                          'border-2 px-1 py-px font-mono text-[11px] tabular-nums',
                          active
                            ? 'border-ink bg-paper text-ink'
                            : item.danger
                              ? 'border-paper bg-hot-pink text-ink'
                              : 'border-paper bg-transparent text-paper',
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

      <div className="border-t-2 border-paper px-3 pb-4 pt-4">
        <div className="border-2 border-paper bg-ink p-3">
          <div className="flex items-center gap-2">
            {activeCount > 0 ? (
              <LiveDot />
            ) : (
              <span className="size-2 border-2 border-paper bg-hot-pink" aria-hidden="true" />
            )}
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-paper">
              {activeCount > 0 ? '防护运行中' : '防护已暂停'}
            </span>
            <span className="ml-auto border border-paper px-1 py-px font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-paper">
              示例
            </span>
          </div>
          <p className="mt-2 font-mono text-[12px] leading-[1.6] text-paper">
            {activeCount > 0
              ? `${activeCount} 个端口按白名单管理，日志采集正常。`
              : '暂无启用中的规则，端口保持系统原有策略。'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="mt-2.5 inline-flex items-center gap-1 border-b-2 border-acid-lime font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-acid-lime transition-colors hover:bg-acid-lime hover:text-ink"
          >
            查看运行状态
            <ArrowUpRight className="size-3" strokeWidth={3} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2.5 border-t border-paper px-1 pt-3">
          <span
            className="grid size-7 shrink-0 place-items-center border-2 border-paper bg-paper font-mono text-[12px] font-bold text-ink"
            title={`${platformLabels.osLabel} · ${platformLabels.engineName}`}
          >
            {platformLabels.osInitial}
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-paper">
              {platformLabels.deviceLabel}
            </strong>
            <span className="block truncate font-mono text-[11px] text-paper">
              {platformLabels.osLabel} ·{' '}
              {storageError
                ? '本机存储异常'
                : desktop
                  ? 'SQLite 已连接'
                  : '本地预览'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-paper">v0.1.0</span>
        </div>
      </div>
    </aside>
  )
}
