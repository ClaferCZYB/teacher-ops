/**
 * Excel / CSV 导入导出（学生）
 * 约定导入表头（不区分大小写）：学号 / studentNo、姓名 / name、性别 / gender (男/女/其他)、班级 / className、标签 / tags
 * 性别字段用中文识别；学号留空会自动生成。
 */
import * as XLSX from 'xlsx'
import { downloadBlob } from './helpers'
import type { Student, ClassEntity, Guardian } from '@/types/models'

interface ToCreate {
  classId: string
  studentNo: string
  name: string
  gender: Student['gender']
  tags: string[]
  guardians: Guardian[]
  height?: number | null
}

export interface ImportPreview {
  toCreate: ToCreate[]
  toUpdate: ToCreate[]
  exactMatches: ToCreate[]
  invalid: { row: Record<string, unknown>; reason: string }[]
}

function normalizeGender(input: unknown): Student['gender'] {
  const s = String(input ?? '').trim()
  if (['男', 'm', 'male', 'MALE'].includes(s)) return 'male'
  if (['女', 'f', 'female', 'FEMALE'].includes(s)) return 'female'
  return 'other'
}

function pickHeader(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    for (const r in row) {
      if (r && String(r).trim().toLowerCase() === k.toLowerCase()) {
        const v = row[r]
        return v == null ? '' : String(v).trim()
      }
    }
  }
  return ''
}

export async function importStudentsFromExcel(
  file: File,
  defaultClassId: string,
  existingInClass: Student[],
): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('未找到工作表')
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const existNoSet = new Set(existingInClass.map((s) => s.studentNo))
  const existNameSet = new Set(existingInClass.map((s) => s.name))

  const toCreate: ToCreate[] = []
  const toUpdate: ToCreate[] = []
  const exactMatches: ToCreate[] = []
  const invalid: ImportPreview['invalid'] = []

  for (const r of json) {
    const name = pickHeader(r, ['姓名', 'name', '学生姓名'])
    if (!name) {
      invalid.push({ row: r, reason: '姓名为空' })
      continue
    }
    const studentNo = pickHeader(r, ['学号', 'studentNo', 'no']) || ''
    const gender = normalizeGender(pickHeader(r, ['性别', 'gender']) || 'male')
    const tagStr = pickHeader(r, ['标签', 'tags']) || ''
    const tags = tagStr.split(/[、,，]/).map((x) => x.trim()).filter(Boolean)
    if (!studentNo) {
      invalid.push({ row: r, reason: '学号为空' })
      continue
    }
    // 家长：支持 家长/家长1/家长2 两套
    const guardians: Guardian[] = []
    const g1 = pickHeader(r, ['家长姓名', '家长1姓名', '家长', '父亲', '母亲'])
    if (g1) guardians.push({ name: g1, relation: pickHeader(r, ['家长关系', '家长1关系']), phone: pickHeader(r, ['联系电话', '家长电话', '家长1电话']), isPrimary: true })
    const g2 = pickHeader(r, ['家长2姓名', '第二家长姓名'])
    if (g2) guardians.push({ name: g2, relation: pickHeader(r, ['家长2关系', '第二家长关系']), phone: pickHeader(r, ['家长2电话', '第二家长电话']), isPrimary: false })
    const heightRaw = pickHeader(r, ['身高', 'height'])
    const height = heightRaw ? Number(heightRaw) : null
    const rec: ToCreate = { classId: defaultClassId, studentNo, name, gender, tags, guardians, height }
    if (existNoSet.has(studentNo)) exactMatches.push(rec)
    else if (existNameSet.has(name)) toUpdate.push(rec)
    else toCreate.push(rec)
  }

  return { toCreate, toUpdate, exactMatches, invalid }
}

export async function exportStudentsToExcel(students: Student[], classes: ClassEntity[]): Promise<void> {
  const classMap = new Map(classes.map((c) => [c.id, c.name]))
  const header = ['学号', '姓名', '性别', '班级', '出生日期', '身高', '家长1姓名', '家长1关系', '家长1电话', '家长2姓名', '家长2关系', '家长2电话', '兴趣特长', '标签', '备注']
  const rows = students.map((s) => {
    const g1 = s.guardians?.[0]
    const g2 = s.guardians?.[1]
    return {
      学号: s.studentNo,
      姓名: s.name,
      性别: s.gender === 'male' ? '男' : s.gender === 'female' ? '女' : '其他',
      班级: classMap.get(s.classId) ?? '',
      出生日期: s.birthDate ?? '',
      身高: s.height != null ? s.height : '',
      家长1姓名: g1?.name ?? '',
      家长1关系: g1?.relation ?? '',
      家长1电话: g1?.phone ?? '',
      家长2姓名: g2?.name ?? '',
      家长2关系: g2?.relation ?? '',
      家长2电话: g2?.phone ?? '',
      兴趣特长: s.interest ?? '',
      标签: (s.tags || []).join('、'),
      备注: s.note ?? '',
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows, { header })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '学生')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const filename = `学生列表-${new Date().toISOString().slice(0, 10)}.xlsx`
  downloadBlob(filename, new Blob([out], { type: 'application/octet-stream' }))
}

export function exportStudentsToCSV(students: Student[]): void {
  const header = ['studentNo', 'name', 'gender', 'height', 'tags', 'guardian1Name', 'guardian1Phone', 'guardian2Name', 'guardian2Phone']
  const escape = (s: string) => `"${s.replaceAll('"', '""')}"`
  const body = students.map((s) => {
    const g1 = s.guardians?.[0]
    const g2 = s.guardians?.[1]
    return [
      s.studentNo,
      s.name,
      s.gender,
      s.height != null ? String(s.height) : '',
      (s.tags || []).join('|'),
      g1?.name ?? '',
      g1?.phone ?? '',
      g2?.name ?? '',
      g2?.phone ?? '',
    ].map((v) => escape(String(v ?? ''))).join(',')
  }).join('\n')
  const text = `${header.join(',')}\n${body}`
  downloadBlob(`学生列表-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([text], { type: 'text/csv' }))
}
