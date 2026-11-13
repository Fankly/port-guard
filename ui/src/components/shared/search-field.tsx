import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full sm:max-w-[320px]', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink"
        strokeWidth={2.6}
        aria-hidden="true"
      />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full border-2 border-ink bg-paper pl-10 pr-9 font-mono text-[12px] text-ink transition-[background-color,box-shadow] duration-150 placeholder:text-[12px] placeholder:text-ink hover:bg-slab focus-visible:bg-paper focus-visible:shadow-[4px_4px_0_0_#000] focus-visible:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空搜索"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center border-2 border-ink bg-paper text-ink transition-colors duration-150 hover:bg-hot-pink hover:text-ink"
        >
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
