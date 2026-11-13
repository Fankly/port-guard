import type { ReactNode } from 'react'
import { PreviewChip } from './status'

export function PageHeader({
  label,
  title,
  description,
  actions,
}: {
  label: string
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 border-b-2 border-ink pb-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="h-3 w-8 shrink-0 bg-hot-pink" aria-hidden="true" />
        <span className="font-mono text-[12px] font-bold uppercase tracking-[0.2em]">
          Port Guard / {label}
        </span>
        <PreviewChip />
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1
            tabIndex={-1}
            className="max-w-[900px] font-sans text-[32px] font-black leading-[0.95] tracking-[-0.02em] outline-none sm:text-[48px]"
          >
            {title}
          </h1>
          <p className="mt-3 max-w-[760px] font-mono text-[13px] leading-[1.65] text-ink">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
