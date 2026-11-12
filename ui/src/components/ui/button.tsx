import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(10,86,64,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-primary-strong',
        secondary:
          'border border-border bg-card text-foreground shadow-xs hover:border-border-strong hover:bg-secondary/70',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted',
        ghost:
          'text-muted-foreground hover:bg-muted hover:text-foreground',
        subtle:
          'bg-primary-soft text-accent-foreground hover:bg-[#dcefe4]',
        danger:
          'bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(120,32,24,0.2)] hover:bg-[#9d352b]',
        'danger-ghost':
          'text-destructive hover:bg-destructive-soft',
        link: 'h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 text-[12.5px]',
        sm: 'h-8 px-3 text-[12px]',
        lg: 'h-10 px-4.5 text-[13px]',
        icon: 'size-8',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
