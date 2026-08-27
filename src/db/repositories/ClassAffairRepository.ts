import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { ClassAffair } from '@/types/models'
import type { StoreName } from '../index'

class ClassAffairRepo extends BaseRepository<ClassAffair> {
  store: StoreName = 'classAffairs'

  async listByClass(classId: string): Promise<ClassAffair[]> {
    if (!classId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('classAffairs', 'by-class', classId)) as ClassAffair[]
    return all.filter((a) => !a.deletedAt).sort((a, b) => (a.date || a.createdAt) > (b.date || b.createdAt) ? -1 : 1)
  }
}

export const classAffairRepo = new ClassAffairRepo()
