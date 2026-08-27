import { useUIStore } from '@/store/useUIStore'
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/helpers'

export function ToastHub() {
  const toasts = useUIStore((s) => s.toasts)
  const dismiss = useUIStore((s) => s.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[min(420px,92vw)]">
      {toasts.map((t) => {
        const Icon =
          t.kind === 'success' ? CheckCircle2
          : t.kind === 'warn' ? AlertTriangle
          : t.kind === 'error' ? AlertCircle
          : Info
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cn(
              'flex items-start gap-2 text-left w-full px-3 py-2.5 rounded-md shadow-soft border bg-white animate-in',
              t.kind === 'success' && 'border-ink-200',
              t.kind === 'info' && 'border-sky-200',
              t.kind === 'warn' && 'border-amber-200',
              t.kind === 'error' && 'border-red-200',
            )}
          >
            <Icon
              size={18}
              className={cn(
                'mt-0.5 shrink-0',
                t.kind === 'success' && 'text-ink-600',
                t.kind === 'info' && 'text-sky-600',
                t.kind === 'warn' && 'text-amber-600',
                t.kind === 'error' && 'text-red-600',
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900">{t.title}</div>
              {t.detail && <div className="text-xs text-soft mt-0.5">{t.detail}</div>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
