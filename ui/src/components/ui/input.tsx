import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-[10px] border border-input bg-card px-3 text-[13px] text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/65 hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
