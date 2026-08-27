import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { Student, Guardian } from '@/types/models'
import type { StoreName } from '../index'

/**
 * 老数据迁移：从 v1 的 guardianName/Phone 单字段构造 guardians[0]
 * - 仅迁移一次，结果就地把 _legacy 清空
 */
export function migrateStudent(s: Student): Student {
  // 已有 guardians 数组视为已迁移
  if (Array.isArray((s as any).guardians)) {
    // 但 _legacy 里可能仍残留旧字段，顺手清理
    if (s._legacy) {
      // 不修改源对象，返回副本（避免污染缓存）
      return { ...s, _legacy: undefined }
    }
    return s
  }
  const guardians: Guardian[] = []
  const legacy = s._legacy ?? {
    guardianName: (s as any).guardianName,
    guardianRelation: (s as any).guardianRelation,
    guardianPhone: (s as any).guardianPhone,
  }
  if (legacy?.guardianName || legacy?.guardianPhone) {
    guardians.push({
      name: legacy.guardianName ?? '',
      relation: legacy.guardianRelation,
      phone: legacy.guardianPhone,
      isPrimary: true,
    })
  }
  // 移除顶层 legacy 字段（保留 height / 已迁移的 guardians）
  const out: Student = {
    ...s,
    guardians,
    _legacy: undefined,
  } as Student
  // 注意：v1 顶层遗留的 guardianName 等字段 TS 已经不识别；写回 DB 时用 _legacy 包一层后清除
  return out
}

class StudentRepo extends BaseRepository<Student> {
  store: StoreName = 'students'

  /** 复写 listAll：自动迁移老格式学生 */
  async listAll(): Promise<Student[]> {
    const all = await super.listAll()
    return all.map(migrateStudent)
  }

  async listByClass(classId: string): Promise<Student[]> {
    if (!classId) return []
    const db = await getDB()
    const arr = (await db.getAllFromIndex('students', 'by-class', classId)) as Student[]
    const alive = arr.filter((s) => !s.deletedAt)
    return alive.map(migrateStudent)
  }

  async findById(id: string): Promise<Student | null> {
    const raw = await super.findRawById(id)
    return raw && !raw.deletedAt ? migrateStudent(raw as Student) : null
  }

  /** 搜索（在 class 内或全库） */
  async search(q: string, classId?: string): Promise<Student[]> {
    const all = classId ? await this.listByClass(classId) : await this.listAll()
    const k = q.trim().toLowerCase()
    if (!k) return all
    return all.filter((s) =>
      s.name.toLowerCase().includes(k) ||
      s.studentNo.toLowerCase().includes(k) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(k)),
    )
  }

  async countByClass(classId: string): Promise<number> {
    return (await this.listByClass(classId)).length
  }

  async findByStudentNo(studentNo: string, classId?: string): Promise<Student | null> {
    const all = classId ? await this.listByClass(classId) : await this.listAll()
    return all.find((s) => s.studentNo === studentNo) ?? null
  }

  /** 把老格式学生一次性写回数据库（迁移完成后调用） */
  async migrateAllPersist(): Promise<number> {
    const all = await this.listAllIncludingDeleted()
    let n = 0
    for (const raw of all) {
      const s = raw as Student
      if (!Array.isArray((s as any).guardians)) {
        const migrated = migrateStudent(s)
        await this.update(migrated.id, {
          guardians: migrated.guardians,
          _legacy: undefined,
        } as any)
        n++
      } else if (s._legacy) {
        await this.update(s.id, { _legacy: undefined } as any)
        n++
      }
    }
    return n
  }
}

export const studentRepo = new StudentRepo()