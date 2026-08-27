import { BaseRepository } from '../BaseRepository'
import type { ClassNote } from '@/types/models'
import type { StoreName } from '../index'

class ClassNoteRepo extends BaseRepository<ClassNote> {
  store: StoreName = 'classNotes'
}

export const classNoteRepo = new ClassNoteRepo()
