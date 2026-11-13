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
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                'flex flex-col items-center gap-1 border-r-2 border-ink py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] transition-colors duration-150 last:border-r-0',
                active
                  ? 'bg-ink text-paper'
                  : 'bg-paper text-ink hover:bg-acid-lime',
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.8 : 2.2} />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
