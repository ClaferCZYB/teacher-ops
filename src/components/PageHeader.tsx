import { cn } from '@/utils/helpers'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-ink-900 truncate">{title}</h1>
        {description && <p className="text-xs sm:text-sm text-soft mt-0.5 truncate">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
