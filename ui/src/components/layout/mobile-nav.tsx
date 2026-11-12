import {
  History,
  LayoutDashboard,
  Network,
  ScrollText,
  Settings,
} from 'lucide-react'
import type { PageId } from '../../hooks/use-route'
import { cn } from '../../lib/utils'

const items: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'rules', label: '规则', icon: Network },
  { id: 'access', label: '访问', icon: ScrollText },
  { id: 'operations', label: '操作', icon: History },
  { id: 'settings', label: '设置', icon: Settings },
]

export function MobileNav({
  page,
  onNavigate,
}: {
  page: PageId
  onNavigate: (page: PageId) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="移动端主导航"
    >
      <div className="grid grid-cols-5">
        {items.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-2 text-[10px] transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-10 place-items-center rounded-lg transition-colors',
                  active && 'bg-primary-soft',
                )}
              >
                <Icon size={17} strokeWidth={active ? 2.1 : 1.9} />
              </span>
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
