import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium leading-4',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-soft text-accent-foreground',
        neutral: 'border-border bg-muted/70 text-muted-foreground',
        success: 'border-[#cfe6da] bg-[#edf7f1] text-[#0e6a4e]',
        warning: 'border-[#f0dfbb] bg-warning-soft text-warning',
        danger: 'border-[#f2d3cd] bg-destructive-soft text-destructive',
        outline: 'border-border bg-card text-muted-foreground',
        dark: 'border-white/10 bg-white/[0.06] text-white/60',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
