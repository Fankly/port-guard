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
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center border-2 border-ink bg-hot-pink text-ink shadow-[4px_4px_0_0_#000]">
            <TriangleAlert className="size-5" strokeWidth={2.6} />
          </span>
          <div className="min-w-0">
            <AlertDialogTitle className="font-sans text-[26px] font-black leading-[0.95] tracking-[-0.02em]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-3 font-mono text-[12px] leading-[1.65] text-ink">
              {description}
            </AlertDialogDescription>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t-2 border-ink pt-4 sm:flex-row sm:justify-end">
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
