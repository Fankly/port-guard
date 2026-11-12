import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

type SelectProps = ComponentProps<'select'>

/**
 * Native select, styled to match the rest of the controls. Keeping the native
 * element preserves the platform picker on touch devices and removes a large
 * listbox dependency from the bundle.
 */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <select
        className="h-9 w-full appearance-none rounded-[10px] border border-input bg-card pl-3 pr-8 text-[12.5px] text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
        aria-hidden="true"
      />
    </span>
  )
}
