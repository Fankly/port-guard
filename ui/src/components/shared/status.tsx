import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-1.5 shrink-0', className)} aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
    </span>
  )
}

export function PreviewChip() {
  return (
    <Badge
      variant="outline"
      className="bg-card/70 text-[10px] font-normal text-muted-foreground backdrop-blur"
      title="所有数据均为界面演示样本，不会修改系统防火墙"
    >
      <span className="size-1 rounded-full bg-[#b98a3c]" />
      设计预览
    </Badge>
  )
}

export function ProtocolTag({ protocol }: { protocol: 'tcp' | 'udp' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] px-1.5 py-px font-mono text-[9.5px] font-medium tracking-wide',
        protocol === 'tcp'
          ? 'bg-[#eaf1ee] text-[#456355]'
          : 'bg-[#f4efe4] text-[#7c673f]',
      )}
    >
      {protocol.toUpperCase()}
    </span>
  )
}

export function ResultBadge({ result }: { result: 'allow' | 'block' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
        result === 'allow'
          ? 'border-[#cfe6da] bg-[#eef7f2] text-[#0e6a4e]'
          : 'border-[#f1d5cf] bg-[#fbf0ee] text-[#a13a2e]',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          result === 'allow' ? 'bg-[#1e8b66]' : 'bg-[#c2604a]',
        )}
      />
      {result === 'allow' ? '已放行' : '已拦截'}
    </span>
  )
}

export function StatePill({
  enabled,
  className,
}: {
  enabled: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
        enabled
          ? 'border-[#cfe6da] bg-[#eff8f2] text-[#0e6a4e]'
          : 'border-border bg-muted/70 text-muted-foreground',
        className,
      )}
    >
      {enabled ? (
        <LiveDot className="scale-90" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      )}
      {enabled ? '生效中' : '已停用'}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <h3 className="mt-4 text-[13.5px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-[320px] text-[12px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
