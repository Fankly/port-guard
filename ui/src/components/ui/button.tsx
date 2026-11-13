import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap border-2 border-ink bg-paper font-mono text-[12px] font-bold uppercase leading-none tracking-[0.12em] transition-all duration-150 ease-out disabled:pointer-events-none disabled:border-ink disabled:bg-slab disabled:text-ink disabled:shadow-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'text-ink shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:bg-acid-lime hover:shadow-[10px_10px_0_0_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none',
        primary:
          'bg-hot-pink text-ink shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:bg-acid-lime hover:text-ink hover:shadow-[10px_10px_0_0_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none',
        secondary:
          'text-ink shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:bg-electric-cyan hover:shadow-[10px_10px_0_0_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none',
        outline:
          'text-ink shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:bg-acid-lime hover:shadow-[10px_10px_0_0_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none',
        ghost:
          'border-ink bg-paper text-ink shadow-none hover:bg-slab active:translate-x-[2px] active:translate-y-[2px]',
        subtle:
          'bg-acid-lime text-ink shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:bg-electric-cyan hover:shadow-[10px_10px_0_0_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none',
        danger:
          'bg-hot-pink text-ink shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:bg-ink hover:text-paper hover:shadow-[10px_10px_0_0_#000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none',
        'danger-ghost':
          'border-transparent bg-transparent text-hot-pink shadow-none hover:border-ink hover:bg-hot-pink hover:text-ink active:translate-x-[2px] active:translate-y-[2px]',
        link: 'h-auto border-0 bg-transparent p-0 text-[12px] normal-case tracking-normal text-ink underline decoration-2 underline-offset-4 shadow-none hover:bg-acid-lime hover:no-underline active:translate-x-0 active:translate-y-0',
      },
      size: {
        default: 'h-10 px-4 py-2.5',
        sm: 'h-9 px-3 py-2',
        lg: 'h-12 px-6 py-3',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0',
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
