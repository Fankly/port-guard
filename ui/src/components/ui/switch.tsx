import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-12 shrink-0 cursor-pointer items-center border-2 border-ink bg-paper p-0.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-slab data-[state=checked]:bg-acid-lime data-[state=unchecked]:bg-paper',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 border-2 border-ink bg-ink transition-transform duration-150 data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  )
}
