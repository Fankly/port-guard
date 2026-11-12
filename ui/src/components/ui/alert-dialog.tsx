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
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#07160f]/45 backdrop-blur-[2px] data-[state=closed]:animate-[overlay-out_.15s_ease-in] data-[state=open]:animate-[overlay-in_.2s_ease-out]" />
      <AlertDialogPrimitive.Content
        aria-modal="true"
        className={cn(
          'fixed left-1/2 top-1/2 z-[66] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-lift focus:outline-none data-[state=closed]:animate-[dialog-out_.14s_ease-in] data-[state=open]:animate-[dialog-in_.18s_ease-out]',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}
