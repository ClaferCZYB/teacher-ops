/**
 * 通用 Repository 基类：
 * - 自动注入 id/createdAt/updatedAt/deletedAt
 * - 默认实现软删除过滤
 * - 子类可扩展按索引的查询
 */
import { getDB, type StoreName } from './index'
import { uid, nowIso } from '@/utils/helpers'
import type { BaseEntity } from '@/types/models'

export abstract class BaseRepository<T extends BaseEntity> {
  abstract store: StoreName

  /** 列出未删除的所有 */
  async listAll(): Promise<T[]> {
    const db = await getDB()
    const all = await db.getAll(this.store)
    return (all as unknown as T[]).filter((x) => !x.deletedAt)
  }

  /** 列出全部（包括回收站） */
  async listAllIncludingDeleted(): Promise<T[]> {
    const db = await getDB()
    return (await db.getAll(this.store)) as unknown as T[]
  }

  /** 取出所有已删除（回收站） */
  async listDeleted(): Promise<T[]> {
    const db = await getDB()
    const all = await db.getAll(this.store)
    return (all as unknown as T[]).filter((x) => !!x.deletedAt)
  }

  async findById(id: string): Promise<T | null> {
    const db = await getDB()
    const x = (await db.get(this.store, id)) as T | undefined
    return x && !x.deletedAt ? x : null
  }

  async findRawById(id: string): Promise<T | null> {
    const db = await getDB()
    return ((await db.get(this.store, id)) as T | undefined) ?? null
  }

  /** 创建 */
  async create(input: Record<string, unknown> & Partial<Pick<T, 'id'>>): Promise<T> {
    const id = (input.id as unknown as string) || uid(this.store.slice(0, 3))
    const at = nowIso()
    const entity = {
      ...(input as any),
      id,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    } as unknown as T
    const db = await getDB()
    await db.put(this.store, entity as any)
    return entity
  }

  /** 更新（浅合并，自动维护 updatedAt） */
  async update(id: string, patch: Partial<T>): Promise<T> {
    const db = await getDB()
    const tx = db.transaction(this.store, 'readwrite')
    const current = (await tx.store.get(id)) as T | undefined
    if (!current) throw new Error(`[${this.store}] id=${id} 不存在`)
    if (current.deletedAt) throw new Error(`[${this.store}] id=${id} 已在回收站，无法更新`)
    const next = { ...current, ...patch, id: current.id, updatedAt: nowIso() } as T
    await tx.store.put(next as any)
    await tx.done
    return next
  }

  /** 软删除：进入回收站 */
  async softDelete(id: string): Promise<T> {
    return this.update(id, { deletedAt: nowIso() } as unknown as Partial<T>)
  }

  /** 恢复 */
  async restore(id: string): Promise<T> {
    const db = await getDB()
    const x = (await db.get(this.store, id)) as T | undefined
    if (!x) throw new Error(`[${this.store}] id=${id} 不存在`)
    return this.update(id, { deletedAt: null } as unknown as Partial<T>)
  }

  /** 永久删除 */
  async hardDelete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete(this.store, id)
  }

  /** 清空整表 */
  async clearAll(): Promise<void> {
    const db = await getDB()
    await db.clear(this.store)
  }

  /** 批量插入（用于恢复） */
  async bulkPut(records: T[]): Promise<void> {
    if (!records.length) return
    const db = await getDB()
    const tx = db.transaction(this.store, 'readwrite')
    await Promise.all(records.map((r) => tx.store.put(r as any)))
    await tx.done
  }
}

/** 过滤软删除的工具 */
export function alive<T extends BaseEntity>(arr: T[]): T[] {
  return arr.filter((x) => !x.deletedAt)
}
