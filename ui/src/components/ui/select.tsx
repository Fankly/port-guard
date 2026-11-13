import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

type SelectProps = ComponentProps<'select'>

/**
 * Native select, styled as a hard-edged control. Keeping the native element
 * preserves the platform picker on touch devices.
 */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <select
        className="h-10 w-full appearance-none border-2 border-ink bg-paper py-2 pl-3 pr-9 font-mono text-[12px] text-ink transition-[background-color,box-shadow] duration-150 hover:bg-slab focus-visible:bg-paper focus-visible:shadow-[4px_4px_0_0_#000] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slab disabled:text-ink"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink"
        strokeWidth={2.6}
        aria-hidden="true"
      />
    </span>
  )
}
