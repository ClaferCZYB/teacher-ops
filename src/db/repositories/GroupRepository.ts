import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { Group } from '@/types/models'
import type { StoreName } from '../index'

class GroupRepo extends BaseRepository<Group> {
  store: StoreName = 'groups'

  async listByClass(classId: string): Promise<Group[]> {
    const db = await getDB()
    const all = (await db.getAllFromIndex('groups', 'by-class', classId)) as Group[]
    return all.filter((g) => !g.deletedAt)
  }
}

export const groupRepo = new GroupRepo()
