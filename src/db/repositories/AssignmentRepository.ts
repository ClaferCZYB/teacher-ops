import { BaseRepository } from '../BaseRepository'
import type { Assignment } from '@/types/models'
import type { StoreName } from '../index'

class AssignmentRepo extends BaseRepository<Assignment> {
  store: StoreName = 'assignments'
}

export const assignmentRepo = new AssignmentRepo()
