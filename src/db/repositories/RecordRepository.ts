import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { StudentRecord, RecordType } from '@/types/models'
import type { StoreName } from '../index'

export interface RecordQuery {
  studentId?: string
  classId?: string
  types?: RecordType[]
  fromDate?: string
  toDate?: string
  includeDeleted?: boolean
}

class RecordRepo extends BaseRepository<StudentRecord> {
  store: StoreName = 'records'

  async listByStudent(studentId: string): Promise<StudentRecord[]> {
    if (!studentId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('records', 'by-student', studentId)) as StudentRecord[]
    return all.filter((r) => !r.deletedAt).sort((a, b) =>
      a.occurredAt > b.occurredAt ? -1 : a.occurredAt < b.occurredAt ? 1 : 0,
    )
  }

  async listByClass(classId: string): Promise<StudentRecord[]> {
    if (!classId) return []
    const db = await getDB()
    const arr = (await db.getAllFromIndex('records', 'by-class', classId)) as StudentRecord[]
    return arr.filter((r) => !r.deletedAt).sort((a, b) =>
      a.occurredAt > b.occurredAt ? -1 : a.occurredAt < b.occurredAt ? 1 : 0,
    )
  }

  /** 通用查询（用于时间轴） */
  async query(q: RecordQuery): Promise<StudentRecord[]> {
    const base = q.studentId ? await this.listByStudent(q.studentId) : q.classId ? await this.listByClass(q.classId) : await this.listAll()
    let r = base
    if (q.types && q.types.length) {
      const set = new Set(q.types)
      r = r.filter((x) => set.has(x.type))
    }
    if (q.fromDate) r = r.filter((x) => x.occurredAt >= q.fromDate!)
    if (q.toDate) r = r.filter((x) => x.occurredAt <= q.toDate!)
    return r
  }

  /** 待跟进记录 */
  async listUpcomingFollowUp(limit = 10): Promise<StudentRecord[]> {
    const all = await this.listAll()
    const now = new Date().toISOString()
    return all
      .filter((r) => r.followUpAt && !r.followUpDone && r.followUpAt >= now)
      .sort((a, b) => (a.followUpAt! > b.followUpAt! ? 1 : -1))
      .slice(0, limit)
  }

  /** 通过关联实体查询（作业 / 考勤 同步用） */
  async listByRelated(relatedType: NonNullable<StudentRecord['relatedType']>, relatedId: string): Promise<StudentRecord[]> {
    if (!relatedId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('records', 'by-related', relatedId)) as StudentRecord[]
    return all.filter((r) => !r.deletedAt && r.relatedType === relatedType)
  }
}

export const recordRepo = new RecordRepo()
