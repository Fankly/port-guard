import { cn } from '../../lib/utils'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  count?: number
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-[10px] border border-border bg-muted/70 p-0.5',
        className,
      )}
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[11.5px] transition-[background-color,color,box-shadow] duration-150',
              active
                ? 'bg-card font-medium text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px font-mono text-[9.5px] tabular-nums',
                  active
                    ? 'bg-primary-soft text-accent-foreground'
                    : 'bg-black/[0.045] text-muted-foreground',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
