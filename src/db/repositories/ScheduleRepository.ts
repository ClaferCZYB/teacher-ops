import { BaseRepository } from '../BaseRepository'
import type { Schedule } from '@/types/models'
import type { StoreName } from '../index'

class ScheduleRepo extends BaseRepository<Schedule> {
  store: StoreName = 'schedules'
}

export const scheduleRepo = new ScheduleRepo()
