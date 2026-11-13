import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[70] overflow-hidden border-2 border-paper bg-ink px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-paper shadow-[4px_4px_0_0_#000]',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
