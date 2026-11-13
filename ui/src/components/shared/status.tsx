import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-2 shrink-0 border-2 border-ink bg-acid-lime',
        className,
      )}
      aria-hidden="true"
    />
  )
}

export function PreviewChip() {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 bg-paper font-mono text-[11px] font-bold tracking-[0.12em] shadow-[2px_2px_0_0_#000]"
      title="系统规则与应用配置从本机读取；防火墙执行层尚未接入"
    >
      <span className="size-1.5 bg-hot-pink" aria-hidden="true" />
      设计预览
    </Badge>
  )
}

export function ProtocolTag({ protocol }: { protocol: 'tcp' | 'udp' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border-2 border-ink px-1.5 py-px font-mono text-[11px] font-bold leading-[1.4] tracking-[0.08em]',
        protocol === 'tcp'
          ? 'bg-acid-lime text-ink'
          : 'bg-electric-cyan text-ink',
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
        'inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[0.06em]',
        result === 'allow'
          ? 'bg-electric-cyan text-ink'
          : 'bg-hot-pink text-ink',
      )}
    >
      <span
        className={cn(
          'size-1.5 border border-current',
          result === 'allow' ? 'bg-ink' : 'bg-paper',
        )}
        aria-hidden="true"
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
        'inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[0.06em]',
        enabled ? 'bg-acid-lime text-ink' : 'bg-slab text-ink',
        className,
      )}
    >
      {enabled ? (
        <span className="size-1.5 bg-ink" aria-hidden="true" />
      ) : (
        <span className="size-1.5 border border-ink bg-paper" aria-hidden="true" />
      )}
      {enabled ? '已启用' : '已停用'}
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
        'flex flex-col items-start justify-center px-6 py-12 text-left',
        className,
      )}
    >
      <span className="grid size-12 place-items-center border-2 border-ink bg-acid-lime text-ink shadow-[4px_4px_0_0_#000]">
        {icon}
      </span>
      <h3 className="mt-5 font-sans text-[22px] font-black leading-[1.05] tracking-[-0.02em]">
        {title}
      </h3>
      <p className="mt-2 max-w-[420px] font-mono text-[12px] leading-[1.65] text-ink">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
