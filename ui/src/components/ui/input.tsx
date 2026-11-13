import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full border-2 border-ink bg-paper px-3.5 font-mono text-[14px] text-ink transition-[background-color,box-shadow] duration-150 placeholder:font-mono placeholder:text-[12px] placeholder:text-ink hover:bg-slab focus-visible:bg-paper focus-visible:shadow-[4px_4px_0_0_#000] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slab disabled:text-ink',
        className,
      )}
      {...props}
    />
  )
}
