import { cn } from '@/utils/helpers'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  block?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink-700 text-paper-50 hover:bg-ink-800 active:bg-ink-900 disabled:opacity-50',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 disabled:opacity-50',
  outline: 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-11 px-4 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  block,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}
