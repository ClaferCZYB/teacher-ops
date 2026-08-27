/**
 * IndexedDB 封装层
 * - 使用 idb（Promise 友好）
 * - 所有 Repository 走统一的 store 设计
 * - version=2：第一版主结构（11 个 object store + meta）
 */
import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type {
  Teacher, ClassEntity, Student, Group, StudentRecord, Communication,
  Attendance, Exam, Grade, Assignment, Task, Schedule, ClassNote,
  Reflection, ClassAffair, KnowledgePoint, BehaviorRule, Meta,
} from '@/types/models'

export const DB_NAME = 'teacher-ops-db'
export const DB_VERSION = 3

interface TOPSchema extends DBSchema {
  teachers: { key: string; value: Teacher; indexes: { 'by-updatedAt': string } }
  classes: { key: string; value: ClassEntity; indexes: { 'by-updatedAt': string; 'by-isHomeroom': string } }
  students: {
    key: string
    value: Student
    indexes: { 'by-class': string; 'by-name': string; 'by-updatedAt': string }
  }
  groups: { key: string; value: Group; indexes: { 'by-class': string } }
  records: {
    key: string
    value: StudentRecord
    indexes: { 'by-student': string; 'by-class': string; 'by-occurredAt': string; 'by-type': string; 'by-related': string }
  }
  communications: {
    key: string
    value: Communication
    indexes: { 'by-student': string; 'by-class': string; 'by-occurredAt': string }
  }
  attendance: {
    key: string
    value: Attendance
    indexes: { 'by-student': string; 'by-class': string; 'by-date': string }
  }
  exams: { key: string; value: Exam; indexes: { 'by-class': string; 'by-examDate': string } }
  grades: {
    key: string
    value: Grade
    indexes: { 'by-exam': string; 'by-student': string; 'by-class': string }
  }
  assignments: {
    key: string
    value: Assignment
    indexes: { 'by-class': string; 'by-dueAt': string }
  }
  tasks: {
    key: string
    value: Task
    indexes: { 'by-due': string; 'by-done': string; 'by-class': string }
  }
  schedules: { key: string; value: Schedule; indexes: { 'by-class': string; 'by-weekday': string } }
  classNotes: { key: string; value: ClassNote; indexes: { 'by-class': string; 'by-date': string } }
  reflections: { key: string; value: Reflection; indexes: { 'by-class': string; 'by-date': string } }
  classAffairs: { key: string; value: ClassAffair; indexes: { 'by-class': string; 'by-type': string } }
  knowledgePoints: { key: string; value: KnowledgePoint; indexes: { 'by-subject': string } }
  behaviorRules: { key: string; value: BehaviorRule; indexes: { 'by-class': string } }
  meta: { key: string; value: Meta }
}

let dbPromise: Promise<IDBPDatabase<TOPSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<TOPSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TOPSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        // 注意：升级时如果 oldVersion 是 1 也要带上完整结构（兼容旧用户的备份）
        // 所有 store 在新装时都创建
        const ensure = <K extends keyof TOPSchema>(name: K, keyPath: TOPSchema[K]['key']) => {
          if (!(db.objectStoreNames as any).contains(name as string)) {
            ;(db as any).createObjectStore(name as string, { keyPath: keyPath as string })
          }
        }

        ensure('teachers', 'id')
        ensure('classes', 'id')
        ensure('students', 'id')
        ensure('groups', 'id')
        ensure('records', 'id')
        ensure('communications', 'id')
        ensure('attendance', 'id')
        ensure('exams', 'id')
        ensure('grades', 'id')
        ensure('assignments', 'id')
        ensure('tasks', 'id')
        ensure('schedules', 'id')
        ensure('classNotes', 'id')
        ensure('reflections', 'id')
        ensure('classAffairs', 'id')
        ensure('knowledgePoints', 'id')
        ensure('behaviorRules', 'id')
        ensure('meta', 'key')

        // 创建索引
        const addIdx = (store: string, name: string, keyPath: string) => {
          const os: any = (tx as any).objectStore(store)
          if (!os.indexNames.contains(name)) os.createIndex(name, keyPath)
        }

        // teachers
        addIdx('teachers', 'by-updatedAt', 'updatedAt')
        // classes
        addIdx('classes', 'by-updatedAt', 'updatedAt')
        addIdx('classes', 'by-isHomeroom', 'isHomeroom')
        // students
        addIdx('students', 'by-class', 'classId')
        addIdx('students', 'by-name', 'name')
        addIdx('students', 'by-updatedAt', 'updatedAt')
        // groups
        addIdx('groups', 'by-class', 'classId')
        // records
        addIdx('records', 'by-student', 'studentId')
        addIdx('records', 'by-class', 'classId')
        addIdx('records', 'by-occurredAt', 'occurredAt')
        addIdx('records', 'by-type', 'type')
        addIdx('records', 'by-related', 'relatedId')
        // communications
        addIdx('communications', 'by-student', 'studentId')
        addIdx('communications', 'by-class', 'classId')
        addIdx('communications', 'by-occurredAt', 'occurredAt')
        // attendance
        addIdx('attendance', 'by-student', 'studentId')
        addIdx('attendance', 'by-class', 'classId')
        addIdx('attendance', 'by-date', 'date')
        // exams
        addIdx('exams', 'by-class', 'classId')
        addIdx('exams', 'by-examDate', 'examDate')
        // grades
        addIdx('grades', 'by-exam', 'examId')
        addIdx('grades', 'by-student', 'studentId')
        addIdx('grades', 'by-class', 'classId')
        // assignments
        addIdx('assignments', 'by-class', 'classId')
        addIdx('assignments', 'by-dueAt', 'dueAt')
        // tasks
        addIdx('tasks', 'by-due', 'dueDate')
        addIdx('tasks', 'by-done', 'done')
        addIdx('tasks', 'by-class', 'classId')
        // schedules
        addIdx('schedules', 'by-class', 'classId')
        addIdx('schedules', 'by-weekday', 'weekday')
        // classNotes
        addIdx('classNotes', 'by-class', 'classId')
        addIdx('classNotes', 'by-date', 'date')
        // reflections
        addIdx('reflections', 'by-class', 'classId')
        addIdx('reflections', 'by-date', 'date')
        // classAffairs
        addIdx('classAffairs', 'by-class', 'classId')
        addIdx('classAffairs', 'by-type', 'type')
        // knowledgePoints
        addIdx('knowledgePoints', 'by-subject', 'subject')
        // behaviorRules
        addIdx('behaviorRules', 'by-class', 'classId')
      },
      blocked() {
        console.warn('IndexedDB blocked by another tab')
      },
      blocking() {
        console.warn('This tab is blocking another version upgrade')
      },
      terminated() {
        console.warn('IndexedDB connection terminated')
      },
    })
  }
  return dbPromise
}

export async function initDB(): Promise<void> {
  const db = await getDB()
  // 写入 schema version
  await db.put('meta', { key: 'schemaVersion', value: DB_VERSION, updatedAt: new Date().toISOString() })
  // 首次访问：写入 installation 标记
  const installed = await db.get('meta', 'installedAt')
  if (!installed) {
    await db.put('meta', {
      key: 'installedAt',
      value: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
}

export type DBType = TOPSchema
export const STORES = [
  'teachers', 'classes', 'students', 'groups', 'records',
  'communications', 'attendance', 'exams', 'grades',
  'assignments', 'tasks', 'schedules', 'classNotes',
  'reflections', 'classAffairs', 'knowledgePoints', 'behaviorRules', 'meta',
] as const

export type StoreName = typeof STORES[number]
