import { BaseRepository } from '../BaseRepository'
import type { ClassEntity } from '@/types/models'
import type { StoreName } from '../index'

class ClassRepo extends BaseRepository<ClassEntity> {
  store: StoreName = 'classes'

  async homeroomClass(): Promise<ClassEntity | null> {
    const all = await this.listAll()
    return all.find((c) => c.isHomeroom && c.status === 'active') ?? null
  }
}

export const classRepo = new ClassRepo()
