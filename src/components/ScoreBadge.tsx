/**
 * 加减分标签 — 正向绿 / 重大正向金 / 负向红 / 零灰
 */
import { cn } from '@/utils/helpers'

interface ScoreBadgeProps {
  score?: number | null
  /** 是否重大正向（用于荣誉奖项 / 重大处分） */
  strong?: boolean
  showSign?: boolean
  className?: string
}

export function ScoreBadge({ score, strong, showSign = true, className }: ScoreBadgeProps) {
  if (score == null || Number.isNaN(score)) {
    return <span className={cn('chip score-zero', className)}>—</span>
  }
  const isPos = score > 0
  const isNeg = score < 0
  const cls = isPos ? (strong ? 'score-pos-strong' : 'score-pos') : isNeg ? 'score-neg' : 'score-zero'
  const sign = showSign ? (score > 0 ? '+' : '') : ''
  return (
    <span className={cn('chip', cls, className)}>
      {sign}
      {score}
    </span>
  )
}

/** 内联式：单行分数渲染（不带 chip 边框） */
export function ScoreInline({ score, strong, className }: ScoreBadgeProps) {
  if (score == null || Number.isNaN(score)) return <span className={cn('text-soft', className)}>—</span>
  const isPos = score > 0
  const isNeg = score < 0
  const cls = isPos ? (strong ? 'text-award-700' : 'text-reward-700') : isNeg ? 'text-demerit-700' : 'text-soft'
  return (
    <span className={cn('font-medium tabular-nums', cls, className)}>
      {score > 0 ? '+' : ''}
      {score}
    </span>
  )
}