import { cn } from '@/utils/helpers'

interface LoaderProps {
  text?: string
  className?: string
}

export function Loader({ text = '加载中…', className }: LoaderProps) {
  return (
    <div className={cn('flex items-center gap-2 text-soft text-sm', className)}>
      <span className="inline-block w-3 h-3 border-2 border-ink-300 border-t-ink-700 rounded-full animate-spin" />
      <span>{text}</span>
    </div>
  )
}
