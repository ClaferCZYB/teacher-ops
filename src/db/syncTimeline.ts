/**
 * 自动把"作业异常 / 考勤异常"同步进学生时间轴（成长记录）
 * - 正常状态（已交 / 出勤）不写冗余记录
 * - 异常状态（未交 / 迟交 / 缺勤 / 迟到 / 早退 / 请假）写一条 StudentRecord
 * - 状态恢复正常时自动删除对应记录，避免历史垃圾
 */
import { recordRepo } from './repositories'
import type { Assignment, AssignmentCompletion, Attendance } from '@/types/models'
import { getScoreFor } from '@/utils/scoring'

const TAG_HOMEWORK = '作业'
const TAG_ATTEND = '考勤'

const ATTEND_LABEL: Record<Attendance['status'], string> = {
  present: '出勤',
  late: '迟到',
  early: '早退',
  leave: '请假',
  absent: '缺勤',
  other: '其他',
}

/**
 * 作业完成情况变化后调用。
 * needRecord：未交 / 迟交 视为需关注（已交 / 豁免 / 待完成 不写）。
 */
export async function syncAssignmentCompletion(
  assignment: Assignment,
  completion: AssignmentCompletion,
): Promise<void> {
  const needRecord = completion.status === 'missing' || completion.status === 'late'
  const existing = (await recordRepo.listByRelated('assignment', assignment.id))
    .find((r) => r.studentId === completion.studentId)

  if (!needRecord) {
    if (existing) await recordRepo.hardDelete(existing.id)
    return
  }

  const key = completion.status === 'late' ? 'assignment:late' : 'assignment:missing'
  const score = await getScoreFor(key)
  const verb = completion.status === 'late' ? '迟交' : '未交'
  const content = `作业「${assignment.title}」${verb}${completion.remark ? `（${completion.remark}）` : ''}`
  if (existing) {
    await recordRepo.update(existing.id, {
      title: '作业未完成',
      occurredAt: assignment.dueAt,
      content,
      score,
      tags: [TAG_HOMEWORK],
    })
  } else {
    await recordRepo.create({
      studentId: completion.studentId,
      classId: assignment.classId,
      type: 'behavior',
      title: '作业未完成',
      occurredAt: assignment.dueAt,
      content,
      score,
      tags: [TAG_HOMEWORK],
      relatedId: assignment.id,
      relatedType: 'assignment',
    })
  }
}

/**
 * 考勤记录变化后调用。present 不写；其余异常写记录。
 */
export async function syncAttendance(attendance: Attendance): Promise<void> {
  const needRecord = attendance.status !== 'present'
  const existing = (await recordRepo.listByRelated('attendance', attendance.id))
    .find((r) => r.studentId === attendance.studentId)

  if (!needRecord) {
    if (existing) await recordRepo.hardDelete(existing.id)
    return
  }

  const key = `attendance:${attendance.status}`
  const score = await getScoreFor(key)
  const content = `${ATTEND_LABEL[attendance.status]}${attendance.remark ? `（${attendance.remark}）` : ''}`
  if (existing) {
    await recordRepo.update(existing.id, {
      title: `考勤 · ${ATTEND_LABEL[attendance.status]}`,
      occurredAt: `${attendance.date}T08:00:00.000Z`,
      content,
      score,
      tags: [TAG_ATTEND],
    })
  } else {
    await recordRepo.create({
      studentId: attendance.studentId,
      classId: attendance.classId,
      type: 'attendance',
      title: `考勤 · ${ATTEND_LABEL[attendance.status]}`,
      occurredAt: `${attendance.date}T08:00:00.000Z`,
      content,
      score,
      tags: [TAG_ATTEND],
      relatedId: attendance.id,
      relatedType: 'attendance',
    })
  }
}

/** 删除整个作业时，清掉其所有关联记录 */
export async function clearAssignmentRecords(assignmentId: string): Promise<void> {
  const recs = await recordRepo.listByRelated('assignment', assignmentId)
  for (const r of recs) await recordRepo.hardDelete(r.id)
}

/** 删除某条考勤时，清掉关联记录 */
export async function clearAttendanceRecord(attendanceId: string): Promise<void> {
  const recs = await recordRepo.listByRelated('attendance', attendanceId)
  for (const r of recs) await recordRepo.hardDelete(r.id)
}
