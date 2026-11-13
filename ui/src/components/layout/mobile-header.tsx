import { ShieldCheck } from 'lucide-react'
import { LiveDot, PreviewChip } from '../shared/status'

export function MobileHeader({
  desktop,
  activeCount,
  storageError,
}: {
  desktop: boolean
  activeCount: number
  storageError: boolean
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-4 border-ink bg-paper px-4 lg:hidden">
      <span className="grid size-9 shrink-0 place-items-center border-2 border-ink bg-ink text-acid-lime shadow-[3px_3px_0_0_#000]">
        <ShieldCheck className="size-4" strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate font-sans text-[14px] font-black uppercase leading-tight tracking-[-0.01em]">
          Port Guard
        </strong>
        <span className="mt-0.5 block truncate font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
          本机端口白名单 ·{' '}
          {storageError ? '本机存储异常' : desktop ? '本机存储' : '设计预览'}
        </span>
      </div>
      <span className="hidden min-[420px]:flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
        {activeCount > 0 ? <LiveDot /> : <span className="size-2 border border-ink bg-hot-pink" />}
        {activeCount > 0 ? '防护中' : '未启用'}
      </span>
      <PreviewChip />
    </header>
  )
}
