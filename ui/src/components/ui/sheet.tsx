import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const Sheet = DialogPrimitive.Root
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-ink" />
      <DialogPrimitive.Content
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[600px] flex-col border-l-4 border-ink bg-paper shadow-[-10px_0_0_0_#ccff00] focus:outline-none data-[state=closed]:animate-[sheet-out_.2s_ease-in] data-[state=open]:animate-[sheet-in_.22s_ease-out]',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
