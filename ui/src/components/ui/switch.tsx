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
        'peer inline-flex h-[21px] w-[37px] shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-[#d5dcd4]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[17px] rounded-full bg-white shadow-[0_1px_2px_rgba(16,32,24,0.24)] transition-transform duration-200 data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[2px]" />
    </SwitchPrimitive.Root>
  )
}
