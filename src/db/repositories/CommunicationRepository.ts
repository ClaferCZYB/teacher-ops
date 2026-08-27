import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { Communication } from '@/types/models'
import type { StoreName } from '../index'

class ComRepo extends BaseRepository<Communication> {
  store: StoreName = 'communications'

  async listByStudent(studentId: string): Promise<Communication[]> {
    if (!studentId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('communications', 'by-student', studentId)) as Communication[]
    return all.filter((c) => !c.deletedAt).sort((a, b) => (a.occurredAt > b.occurredAt ? -1 : 1))
  }

  async listByClass(classId: string): Promise<Communication[]> {
    if (!classId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('communications', 'by-class', classId)) as Communication[]
    return all.filter((c) => !c.deletedAt).sort((a, b) => (a.occurredAt > b.occurredAt ? -1 : 1))
  }
}

export const communicationRepo = new ComRepo()
