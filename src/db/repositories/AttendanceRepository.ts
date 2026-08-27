import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { Attendance } from '@/types/models'
import type { StoreName } from '../index'

class AttendanceRepo extends BaseRepository<Attendance> {
  store: StoreName = 'attendance'

  async listByClass(classId: string, fromDate?: string, toDate?: string): Promise<Attendance[]> {
    if (!classId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('attendance', 'by-class', classId)) as Attendance[]
    const filtered = all.filter((a) => !a.deletedAt)
    return filtered.filter((a) => {
      if (fromDate && a.date < fromDate) return false
      if (toDate && a.date > toDate) return false
      return true
    })
  }

  async listByStudent(studentId: string): Promise<Attendance[]> {
    if (!studentId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('attendance', 'by-student', studentId)) as Attendance[]
    return all
      .filter((a) => !a.deletedAt)
      .sort((a, b) => (a.date > b.date ? -1 : 1))
  }

  async listByDate(date: string, classId?: string): Promise<Attendance[]> {
    const db = await getDB()
    const all = (await db.getAllFromIndex('attendance', 'by-date', date)) as Attendance[]
    return all.filter((a) => !a.deletedAt && (!classId || a.classId === classId))
  }

  /** upsert（学生 + 日期） */
  async upsertForStudent(opts: {
    studentId: string
    classId: string
    date: string
    status: Attendance['status']
    remark?: string
  }): Promise<Attendance> {
    const db = await getDB()
    const all = (await db.getAllFromIndex('attendance', 'by-student', opts.studentId)) as Attendance[]
    const existed = all.find((a) => a.date === opts.date && !a.deletedAt)
    if (existed) {
      return this.update(existed.id, {
        status: opts.status,
        remark: opts.remark ?? existed.remark,
      })
    }
    return this.create({
      studentId: opts.studentId,
      classId: opts.classId,
      date: opts.date,
      status: opts.status,
      remark: opts.remark,
    })
  }
}

export const attendanceRepo = new AttendanceRepo()
