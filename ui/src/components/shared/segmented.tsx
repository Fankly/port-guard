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
        'inline-flex shrink-0 items-center border-2 border-ink bg-paper p-0.5',
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
              'inline-flex h-8 items-center gap-1.5 px-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.04em] transition-colors duration-150',
              active
                ? 'bg-ink text-paper'
                : 'text-ink hover:bg-acid-lime',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'border border-current px-1 py-px font-mono text-[11px] tabular-nums',
                  active ? 'bg-paper text-ink' : 'bg-paper text-ink',
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
