/**
 * 性别标签 — 男（深蓝/浅蓝底）女（粉/浅粉底）其他（灰）
 */
import type { Student } from '@/types/models'
import { cn } from '@/utils/helpers'

export function GenderBadge({
  gender,
  size = 'sm',
  className,
}: {
  gender: Student['gender']
  size?: 'xs' | 'sm'
  className?: string
}) {
  const cls =
    gender === 'male'
      ? 'gender-male'
      : gender === 'female'
      ? 'gender-female'
      : 'gender-other'
  const text = gender === 'male' ? '男' : gender === 'female' ? '女' : '其他'
  return (
    <span
      className={cn(
        cls,
        'inline-flex items-center justify-center font-medium rounded-sm',
        size === 'xs' ? 'w-4 h-4 text-[10px]' : 'px-1.5 min-w-[18px] h-[18px] text-2xs',
        className,
      )}
    >
      {text}
    </span>
  )
}

/** 简化的"性"字符图标（用作头像/座位表中的小指示） */
export function GenderDot({ gender }: { gender: Student['gender'] }) {
  const cls = gender === 'male' ? 'bg-male-600' : gender === 'female' ? 'bg-female-600' : 'bg-muted-400'
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full', cls)} aria-hidden />
}