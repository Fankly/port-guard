import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('border-2 border-ink bg-slab', className)}
      {...props}
    />
  )
}
