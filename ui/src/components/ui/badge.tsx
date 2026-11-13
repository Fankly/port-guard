import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-mono text-[12px] font-bold uppercase leading-4 tracking-[0.12em]',
  {
    variants: {
      variant: {
        default: 'bg-acid-lime text-ink',
        neutral: 'bg-slab text-ink',
        success: 'bg-electric-cyan text-ink',
        warning: 'bg-tangerine text-ink',
        danger: 'bg-hot-pink text-ink',
        outline: 'bg-paper text-ink',
        dark: 'bg-ink text-paper',
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
