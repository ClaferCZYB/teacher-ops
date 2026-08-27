import { cn } from '@/utils/helpers'

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info'

const TONE: Record<Tone, string> = {
  neutral: 'status-neutral',
  good: 'status-good',
  warn: 'status-warn',
  bad: 'status-bad',
  info: 'status-info',
}

interface TagProps {
  tone?: Tone
  children: React.ReactNode
  className?: string
}

export function Tag({ tone = 'neutral', children, className }: TagProps) {
  return <span className={cn('chip', TONE[tone], className)}>{children}</span>
}
