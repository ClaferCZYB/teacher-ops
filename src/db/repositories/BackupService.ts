/**
 * 备份 / 恢复 / 清空
 */
import { getDB, STORES } from '../index'
import type { BackupSnapshot } from '@/types/models'
import { nowIso } from '@/utils/helpers'
import { teacherRepo, classRepo, studentRepo, groupRepo, recordRepo, communicationRepo,
  attendanceRepo, examRepo, gradeRepo, assignmentRepo, taskRepo, scheduleRepo,
  classNoteRepo, reflectionRepo, classAffairRepo, knowledgePointRepo, behaviorRuleRepo, metaRepo,
} from './index'

export const BACKUP_VERSION = 1

export async function exportBackup(): Promise<BackupSnapshot> {
  const db = await getDB()
  const grab = async (store: typeof STORES[number]) => (await db.getAll(store)) as any[]
  return {
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    teachers: await grab('teachers'),
    classes: await grab('classes'),
    students: await grab('students'),
    groups: await grab('groups'),
    records: await grab('records'),
    communications: await grab('communications'),
    attendance: await grab('attendance'),
    exams: await grab('exams'),
    grades: await grab('grades'),
    assignments: await grab('assignments'),
    tasks: await grab('tasks'),
    schedules: await grab('schedules'),
    classNotes: await grab('classNotes'),
    reflections: await grab('reflections'),
    classAffairs: await grab('classAffairs'),
    knowledgePoints: await grab('knowledgePoints'),
    behaviorRules: await grab('behaviorRules'),
    meta: await grab('meta'),
  }
}

export interface ImportPreview {
  snapshot: BackupSnapshot
  counts: Record<string, number>
}

export async function previewImport(snapshot: BackupSnapshot): Promise<ImportPreview> {
  const counts: Record<string, number> = {}
  for (const k of STORES) {
    counts[k] = Array.isArray((snapshot as any)[k]) ? ((snapshot as any)[k] as any[]).length : 0
  }
  return { snapshot, counts }
}

export async function applyImport(snapshot: BackupSnapshot, mode: 'merge' | 'replace' = 'replace'): Promise<void> {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('备份文件格式错误')
  const db = await getDB()

  if (mode === 'replace') {
    for (const k of STORES) {
      await db.clear(k as any)
    }
  }

  const tx = db.transaction(STORES as any, 'readwrite')
  const stores = (snapshot as any)
  for (const k of STORES) {
    const list = stores[k]
    if (Array.isArray(list)) {
      for (const r of list) {
        await tx.objectStore(k as any).put(r as any)
      }
    }
  }
  await tx.done
}

export async function wipeAll(): Promise<void> {
  const db = await getDB()
  for (const k of STORES) {
    if (k !== 'meta') await db.clear(k as any)
  }
}

export const BackupService = {
  export: exportBackup,
  preview: previewImport,
  import: applyImport,
  wipeAll,
}
