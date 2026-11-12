import type { ReactNode } from 'react'
import { PreviewChip } from './status'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-col gap-3.5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 tabIndex={-1} className="text-[24px] outline-none font-semibold leading-tight tracking-[-0.025em] sm:text-[26px]">
            {title}
          </h1>
          <PreviewChip />
        </div>
        <p className="mt-1.5 max-w-[660px] text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
