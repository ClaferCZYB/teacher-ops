import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** 底部操作区 */
  footer?: React.ReactNode
  /** 隐藏关闭按钮 */
  hideClose?: boolean
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, description, children, size = 'md', className, footer, hideClose }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full sm:w-auto sm:min-w-[420px] bg-white border border-ink-100 shadow-soft rounded-t-xl sm:rounded-lg flex flex-col max-h-[92vh] overflow-hidden',
          SIZE[size],
          className,
        )}
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-ink-100">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900 truncate">{title}</div>
            {description && <div className="text-xs text-soft mt-0.5">{description}</div>}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 -mr-1 rounded text-muted-500 hover:bg-ink-100"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-ink-100 flex justify-end gap-2 bg-paper-50">{footer}</div>}
      </div>
    </div>
  )
}
