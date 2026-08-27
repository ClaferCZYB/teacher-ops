/**
 * 加减分语义与评分规则
 * - 正向类型（日常表现 / 成长事件 / 奖励 / 荣誉）只能非负
 * - 负向类型（处分 / 扣分）只能非正
 * - 考勤与作业异常的分值可由「设置 - 评分规则」自定义
 */
import { behaviorRuleRepo } from '@/db/repositories'
import type { RecordType } from '@/types/models'

/** 正向加分类别：奖励、荣誉、日常表现、成长事件 */
export const POSITIVE_TYPES: RecordType[] = ['behavior', 'growth', 'reward', 'award']

/** 负向扣分类别：处分、扣分 */
export const NEGATIVE_TYPES: RecordType[] = ['demerit', 'punish']

export function isPositiveType(t: RecordType): boolean {
  return POSITIVE_TYPES.includes(t)
}

export function isNegativeType(t: RecordType): boolean {
  return NEGATIVE_TYPES.includes(t)
}

/** 默认分值（仅用于表单初始值，不会被持久化为规则） */
export function defaultScoreForType(t: RecordType): number {
  return isPositiveType(t) ? 1 : -1
}

/** 校验分值是否符合类型语义，返回 null 表示合法，否则返回错误文案 */
export function validateScoreForType(t: RecordType, value: number): string | null {
  if (Number.isNaN(value)) return '分值必须为数字'
  if (isPositiveType(t) && value < 0) return '该类型只能记加分（不能为负）'
  if (isNegativeType(t) && value > 0) return '该类型只能记扣分（不能为正）'
  return null
}

/* -------------- 行为评分规则（考勤 / 作业） -------------- */

/** 内置行为键 → 中文名（用于设置页展示与默认分） */
export const BEHAVIOR_KEY_LABELS: Record<string, string> = {
  'attendance:absent': '考勤 · 缺勤',
  'attendance:late': '考勤 · 迟到',
  'attendance:early': '考勤 · 早退',
  'attendance:leave': '考勤 · 请假',
  'assignment:missing': '作业 · 未交',
  'assignment:late': '作业 · 迟交',
}

/** 默认分值（无自定义规则时使用）。负向行为才有预设，正向由教师手动录入。 */
export const DEFAULT_BEHAVIOR_SCORES: Record<string, number> = {
  'attendance:absent': -2,
  'attendance:late': -1,
  'attendance:early': -1,
  'attendance:leave': 0,
  'assignment:missing': -1,
  'assignment:late': -0.5,
}

/**
 * 取得某行为的分值（支持自定义覆盖）。
 * 优先取「全局默认规则」(classId='') 中启用的覆盖，否则回退内置默认值。
 */
export async function getScoreFor(key: string): Promise<number> {
  try {
    const all = await behaviorRuleRepo.listAll()
    const rule = all.find((r) => !r.deletedAt && r.isActive && r.classId === '' && r.key === key)
    if (rule) return rule.score
  } catch {
    /* 忽略读取异常，回退默认 */
  }
  return DEFAULT_BEHAVIOR_SCORES[key] ?? 0
}
