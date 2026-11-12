import { TriangleAlert } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog
      open
      onOpenChange={open => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <div className="flex gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive-soft text-destructive">
            <TriangleAlert className="size-[19px]" />
          </span>
          <div className="min-w-0">
            <AlertDialogTitle className="text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button variant="secondary">取消</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={danger ? 'danger' : 'default'} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
