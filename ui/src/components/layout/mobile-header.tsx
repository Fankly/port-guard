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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md lg:hidden">
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-linear-to-br from-[#1d926c] to-[#0b5943] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
        <ShieldCheck className="size-4 text-white" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[13px] font-semibold leading-tight">
          Port Guard
        </strong>
        <span className="block truncate text-[10px] text-muted-foreground">
          本机端口白名单 ·{' '}
          {storageError ? '本机存储异常' : desktop ? '本机存储' : '设计预览'}
        </span>
      </div>
      <span className="hidden min-[420px]:flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        {activeCount > 0 ? <LiveDot /> : <span className="size-1.5 rounded-full bg-[#c08a35]" />}
        {activeCount > 0 ? '防护中' : '未启用'}
      </span>
      <PreviewChip />
    </header>
  )
}
