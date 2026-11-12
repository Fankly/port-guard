import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[70] overflow-hidden rounded-md bg-[#13251c] px-2 py-1 text-[11px] font-medium text-white/90 shadow-md data-[state=closed]:animate-[fade-out_.1s_ease-in] data-[state=delayed-open]:animate-[fade-in_.12s_ease-out]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
