import { BaseRepository } from '../BaseRepository'
import type { Reflection } from '@/types/models'
import type { StoreName } from '../index'

class ReflectionRepo extends BaseRepository<Reflection> {
  store: StoreName = 'reflections'
}

export const reflectionRepo = new ReflectionRepo()
