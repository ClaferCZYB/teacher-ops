/**
 * Meta Repository — 系统元数据
 */
import { getDB } from '../index'
import type { Meta } from '@/types/models'
import { nowIso } from '@/utils/helpers'

class MetaRepo {
  async get(key: string): Promise<any> {
    const db = await getDB()
    const row = (await db.get('meta', key)) as Meta | undefined
    return row?.value
  }

  async put(key: string, value: any): Promise<void> {
    const db = await getDB()
    const at = nowIso()
    await db.put('meta', { key, value, updatedAt: at })
  }

  async remove(key: string): Promise<void> {
    const db = await getDB()
    await db.delete('meta', key)
  }
}

export const metaRepo = new MetaRepo()
