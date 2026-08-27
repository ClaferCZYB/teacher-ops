import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { Task } from '@/types/models'
import type { StoreName } from '../index'

class TaskRepo extends BaseRepository<Task> {
  store: StoreName = 'tasks'

  async listOpen(): Promise<Task[]> {
    const all = await this.listAll()
    return all
      .filter((t) => !t.done)
      .sort((a, b) => {
        const pa = priorityWeight(a.priority)
        const pb = priorityWeight(b.priority)
        if (pa !== pb) return pb - pa
        return (a.dueDate || 'zzz') > (b.dueDate || 'zzz') ? -1 : 1
      })
  }

  async listByClass(classId: string): Promise<Task[]> {
    const all = await this.listAll()
    return all.filter((t) => t.classId === classId)
  }

  async listDoneRecent(limit = 10): Promise<Task[]> {
    const all = await this.listAll()
    return all
      .filter((t) => t.done)
      .sort((a, b) => (a.doneAt || a.updatedAt) < (b.doneAt || b.updatedAt) ? 1 : -1)
      .slice(0, limit)
  }
}

function priorityWeight(p: Task['priority']): number {
  if (p === 'high') return 3
  if (p === 'medium') return 2
  return 1
}

export const taskRepo = new TaskRepo()
