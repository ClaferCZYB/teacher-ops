/**
 * Teacher Repository — 取默认教师 / 写入默认教师。
 */
import { BaseRepository } from '../BaseRepository'
import type { Teacher } from '@/types/models'
import type { StoreName } from '../index'

class TeacherRepo extends BaseRepository<Teacher> {
  store: StoreName = 'teachers'

  async getDefault(): Promise<Teacher | null> {
    const all = await this.listAll()
    return all[0] ?? null
  }

  async ensureDefault(): Promise<Teacher> {
    const t = await this.getDefault()
    if (t) return t
    return this.create({
      name: '教师',
      subject: '物理',
      preferences: {
        theme: 'light',
        density: 'comfortable',
        defaultClassId: null,
        defaultTerm: null,
      },
    } as Omit<Teacher, keyof import('@/types/models').BaseEntity>)
  }
}

export const teacherRepo = new TeacherRepo()
