/**
 * 班级管理 — 新增 / 编辑 / 删除 / 设置班主任
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { classRepo, studentRepo } from '@/db/repositories'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import type { ClassEntity } from '@/types/models'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit3, Trash2, GraduationCap, Users } from 'lucide-react'
import { formatDate } from '@/utils/helpers'

const GRADES = ['高一', '高二', '高三']
const TERMS = ['上学期', '下学期']
// 一些常用学年
const ACADEMIC_YEARS = (() => {
  const y = new Date().getFullYear()
  const arr: string[] = []
  for (let i = 0; i < 3; i++) {
    const a = y - i
    arr.push(`${a}-${a + 1}`)
  }
  return arr
})()

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const currentClassId = useUIStore((s) => s.currentClassId)
  const setCurrent = useUIStore((s) => s.setCurrentClassId)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClassEntity | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ClassEntity | null>(null)
  const navigate = useNavigate()

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls)
    const c: Record<string, number> = {}
    for (const x of cls) {
      c[x.id] = await studentRepo.countByClass(x.id)
    }
    setCounts(c)
  }
  useEffect(() => {
    void refresh()
  }, [])

  async function save(input: Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) {
    try {
      if (editing) await classRepo.update(editing.id, input)
      else await classRepo.create(input)
      toast.success(editing ? '班级已更新' : '班级已创建')
      setOpen(false)
      setEditing(null)
      void refresh()
    } catch (e) {
      toast.error('保存失败', String((e as Error)?.message ?? e))
    }
  }

  return (
    <div>
      <PageHeader
        title="班级"
        description="教师管理所有任课班级与班主任班"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus size={14} /> 新建班级
          </Button>
        }
      />
      {classes.length === 0 ? (
        <Empty
          icon={<GraduationCap size={20} />}
          title="还没有班级"
          description="把您任教的班级加入系统，开始管理工作。"
          action={
            <Button onClick={() => { setEditing(null); setOpen(true) }}>
              <Plus size={14} /> 新建班级
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {classes.map((c) => (
            <article key={c.id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-ink-900 truncate">{c.name}</h3>
                    {c.isHomeroom && <Tag tone="warn">班主任</Tag>}
                    {currentClassId === c.id && <Tag tone="info">当前</Tag>}
                  </div>
                  <div className="mt-1 text-xs text-soft">
                    {c.grade} · {c.academicYear} · {c.term}
                  </div>
                  {c.note && <div className="mt-1 text-xs text-soft line-clamp-2">{c.note}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditing(c); setOpen(true) }} className="p-1.5 rounded hover:bg-ink-100 text-soft" aria-label="编辑"><Edit3 size={14} /></button>
                  <button onClick={() => setConfirmDelete(c)} className="p-1.5 rounded hover:bg-ink-100 text-red-600" aria-label="删除"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-soft"><Users size={12} /> {counts[c.id] ?? 0} 学生</span>
                <span className="text-muted-400">·</span>
                <span className="text-soft">{c.subject || '任教学科'}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(c.id)
                    navigate('/students')
                  }}
                  className="btn-outline flex-1"
                >
                  学生
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(c.id)
                    navigate('/seating')
                  }}
                  className="btn-ghost"
                >
                  座位
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(c.id)
                    navigate('/attendance')
                  }}
                  className="btn-ghost text-xs flex-1"
                >
                  考勤
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(c.id)
                    navigate('/grades')
                  }}
                  className="btn-ghost text-xs flex-1"
                >
                  成绩
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ClassFormModal
        open={open}
        onClose={() => { setOpen(false); setEditing(null) }}
        initial={editing}
        onSubmit={save}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await classRepo.softDelete(confirmDelete.id)
            toast.success('班级已移至回收站')
            void refresh()
          } catch (e) {
            toast.error('操作失败', String((e as Error)?.message ?? e))
          }
        }}
        destructive
        title="删除班级"
        description={`将"${confirmDelete?.name}"移至回收站，可在回收站恢复或永久删除。`}
        confirmText="移至回收站"
      />
    </div>
  )
}

interface ClassFormModalProps {
  open: boolean
  onClose: () => void
  initial: ClassEntity | null
  onSubmit: (data: Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => void | Promise<void>
}

function ClassFormModal({ open, onClose, initial, onSubmit }: ClassFormModalProps) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(GRADES[0])
  const [term, setTerm] = useState(TERMS[0])
  const [academicYear, setAcademicYear] = useState(ACADEMIC_YEARS[0])
  const [isHomeroom, setIsHomeroom] = useState(false)
  const [subject, setSubject] = useState('物理')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setGrade(initial.grade)
      setTerm(initial.term)
      setAcademicYear(initial.academicYear)
      setIsHomeroom(initial.isHomeroom)
      setSubject(initial.subject ?? '物理')
      setNote(initial.note ?? '')
    } else {
      setName('')
      setGrade(GRADES[0])
      setTerm(TERMS[0])
      setAcademicYear(ACADEMIC_YEARS[0])
      setIsHomeroom(false)
      setSubject('物理')
      setNote('')
    }
  }, [open, initial])

  async function submit() {
    if (!name.trim()) {
      toast.warn('班级名称不能为空')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        grade,
        term,
        academicYear,
        isHomeroom,
        subject,
        note,
        status: 'active',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '编辑班级' : '新建班级'} size="md">
      <div className="p-4 space-y-3">
        <Field label="班级名称" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：高一(3)班" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="年级">
            <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="学期">
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="学年">
          <select className="input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {ACADEMIC_YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </Field>
        <Field label="任教学科">
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="如：物理" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isHomeroom} onChange={(e) => setIsHomeroom(e.target.checked)} />
          <span>我同时担任此班班主任</span>
        </label>
        <Field label="备注">
          <textarea rows={3} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={submit} loading={submitting}>{initial ? '保存' : '创建'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <div className="text-xs text-soft mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {children}
    </div>
  )
}
