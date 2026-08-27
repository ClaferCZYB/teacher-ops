import { cn } from '@/utils/helpers'

interface EmptyProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function Empty({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6 text-soft', className)}>
      <div className="w-12 h-12 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center mb-3">
        {icon ?? <span className="text-lg">·</span>}
      </div>
      <div className="text-sm font-medium text-ink-800">{title}</div>
      {description && <div className="text-xs text-soft mt-1 max-w-sm">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
