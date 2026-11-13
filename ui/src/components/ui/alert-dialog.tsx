import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogCancel = AlertDialogPrimitive.Cancel
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogTitle = AlertDialogPrimitive.Title
export const AlertDialogDescription = AlertDialogPrimitive.Description

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-ink" />
      <AlertDialogPrimitive.Content
        aria-modal="true"
        className={cn(
          'fixed left-1/2 top-1/2 z-[66] w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 border-4 border-ink bg-paper p-6 shadow-[10px_10px_0_0_#ccff00] focus:outline-none data-[state=closed]:animate-[dialog-out_.14s_ease-in] data-[state=open]:animate-[dialog-in_.16s_ease-out]',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}
