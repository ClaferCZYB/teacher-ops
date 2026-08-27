import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  destructive,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
    >
      <div className="px-4 py-4 flex justify-end gap-2 border-t border-ink-100 bg-paper-50">
        <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={async () => {
            await onConfirm()
            onClose()
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
