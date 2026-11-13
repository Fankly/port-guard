import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'border-2 border-ink bg-card shadow-[8px_8px_0_0_#000] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0_0_#000]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 border-b-2 border-ink bg-slab px-5 py-4',
        className,
      )}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'font-sans text-[24px] font-black leading-[1.05] tracking-[-0.02em]',
        className,
      )}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('mt-1 font-mono text-[12px] leading-[1.5] text-ink', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t-2 border-ink px-5 py-3 font-mono text-[11px] text-ink',
        className,
      )}
      {...props}
    />
  )
}
