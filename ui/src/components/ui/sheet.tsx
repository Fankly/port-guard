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
      <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-[#07160f]/45 backdrop-blur-[2px] data-[state=closed]:animate-[overlay-out_.16s_ease-in] data-[state=open]:animate-[overlay-in_.22s_ease-out]" />
      <DialogPrimitive.Content
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[560px] flex-col border-l border-border bg-card shadow-[-24px_0_80px_-40px_rgba(8,24,16,0.55)] focus:outline-none data-[state=closed]:animate-[sheet-out_.2s_ease-in] data-[state=open]:animate-[sheet-in_.28s_cubic-bezier(0.22,0.8,0.28,1)]',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
