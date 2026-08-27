/**
 * 作业 — 创建作业、一键全部已交、跟进完成情况、自动同步学生时间轴、导出
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { classRepo, assignmentRepo, studentRepo } from '@/db/repositories'
import { syncAssignmentCompletion, clearAssignmentRecords } from '@/db/syncTimeline'
import type { ClassEntity, Assignment, AssignmentCompletion, Student } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import { Plus, Edit3, Trash2, ClipboardList, Check, X, Download } from 'lucide-react'
import { formatDate, downloadBlob } from '@/utils/helpers'

const STATUS_LABEL: Record<AssignmentCompletion['status'], string> = {
  pending: '未交',
  submitted: '已交',
  late: '补交',
  missing: '缺交',
  exempt: '免交',
}

const STATUS_TONE: Record<AssignmentCompletion['status'], 'good' | 'warn' | 'bad' | 'neutral' | 'info'> = {
  pending: 'neutral', submitted: 'good', late: 'warn', missing: 'bad', exempt: 'info',
}

export function AssignmentsPage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [list, setList] = useState<Assignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [confirmDel, setConfirmDel] = useState<Assignment | null>(null)
  const [reviewing, setReviewing] = useState<Assignment | null>(null)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && cls.length) setCid(cls[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) return setList([]); setStudents([])
      const all = await assignmentRepo.listAll()
      const filtered = all.filter((a) => a.classId === cid).sort((a, b) => b.dueAt.localeCompare(a.dueAt))
      setList(filtered)
      const stds = await studentRepo.listByClass(cid)
      setStudents(stds)
    })()
  }, [cid])

  function reload() {
    return (async () => {
      const all = await assignmentRepo.listAll()
      setList(all.filter((a) => a.classId === cid).sort((a, b) => b.dueAt.localeCompare(a.dueAt)))
    })()
  }

  async function deleteAssignment(a: Assignment) {
    await assignmentRepo.softDelete(a.id)
    await clearAssignmentRecords(a.id)
    await reload()
  }

  function exportAssignments() {
    const rows = list.map((a) => {
      const total = a.completions?.length ?? 0
      const submitted = a.completions?.filter((c) => c.status === 'submitted' || c.status === 'late').length ?? 0
      return { 标题: a.title, 科目: a.subject, 发布时间: formatDate(a.publishedAt), 截止: formatDate(a.dueAt), 已交: `${submitted}/${total}`, 完成率: total ? `${((submitted / total) * 100).toFixed(0)}%` : '—' }
    })
    const csv = [
      Object.keys(rows[0] ?? { 标题: '', 科目: '', 发布时间: '', 截止: '', 已交: '', 完成率: '' }).join(','),
      ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')),
    ].join('\n')
    downloadBlob(`作业-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv' }))
  }

  return (
    <div>
      <PageHeader
        title="作业"
        description="布置、一键登记、跟进完成情况（异常自动进入学生时间轴）"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button variant="outline" onClick={exportAssignments} disabled={!list.length}><Download size={14} /> 导出</Button>
            <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!cid}><Plus size={14} /> 新建作业</Button>
          </>
        }
      />

      {!cid ? <Empty title="请选择班级" />
        : list.length === 0 ? <Empty icon={<ClipboardList size={18} />} title="还没有作业" description="把作业统一到这里，跟进完成情况。" action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> 新建作业</Button>} />
        : (
          <div className="space-y-2">
            {list.map((a) => {
              const total = a.completions?.length ?? 0
              const submitted = a.completions?.filter((c) => c.status === 'submitted' || c.status === 'late').length ?? 0
              const overdue = new Date(a.dueAt).getTime() < Date.now() && submitted < total
              const missing = a.completions?.filter((c) => c.status === 'missing').length ?? 0
              return (
                <article key={a.id} className="card p-3 flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-md bg-ink-100 text-ink-700 flex items-center justify-center">
                    <ClipboardList size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{a.title}</h3>
                      <Tag>{a.subject}</Tag>
                      {overdue && <Tag tone="warn">已过期</Tag>}
                      {missing > 0 && <Tag tone="bad">{missing} 人缺交</Tag>}
                    </div>
                    {a.description && <p className="text-xs text-soft mt-1 whitespace-pre-wrap">{a.description}</p>}
                    <div className="text-2xs text-soft mt-1">
                      发布 {formatDate(a.publishedAt)} · 截止 {formatDate(a.dueAt, true)} · 完成率 {total ? `${submitted}/${total}` : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setReviewing(a)}>查看完成</Button>
                    <button onClick={() => { setEditing(a); setOpen(true) }} className="p-1.5 rounded hover:bg-ink-100 text-soft"><Edit3 size={13} /></button>
                    <button onClick={() => setConfirmDel(a)} className="p-1.5 rounded hover:bg-ink-100 text-red-600"><Trash2 size={13} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

      {open && (
        <AssignmentFormModal
          open
          cid={cid}
          editing={editing}
          students={students}
          onClose={() => { setOpen(false); setEditing(null) }}
          onSaved={async () => { setOpen(false); setEditing(null); await reload() }}
        />
      )}

      {reviewing && (
        <AssignmentReviewModal
          open
          assignment={reviewing}
          students={students}
          onClose={() => setReviewing(null)}
          onSaved={async () => { await reload() }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        destructive
        title="删除作业"
        confirmText="删除"
        onConfirm={async () => { if (confirmDel) await deleteAssignment(confirmDel); setConfirmDel(null); toast.success('已删除') }}
      />
    </div>
  )
}

interface AssignmentFormProps {
  open: boolean
  editing: Assignment | null
  cid: string
  students: Student[]
  onClose: () => void
  onSaved: () => void
}

function AssignmentFormModal({ open, cid, editing, students, onClose, onSaved }: AssignmentFormProps) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('物理')
  const [description, setDescription] = useState('')
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 16))
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16))
  const [defaultAllDone, setDefaultAllDone] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title); setSubject(editing.subject); setDescription(editing.description ?? '')
      setPublishedAt(new Date(editing.publishedAt).toISOString().slice(0, 16))
      setDueAt(new Date(editing.dueAt).toISOString().slice(0, 16))
      setDefaultAllDone(false)
    } else {
      setTitle(''); setSubject('物理'); setDescription('')
      setPublishedAt(new Date().toISOString().slice(0, 16))
      setDueAt(new Date(Date.now() + 86400000).toISOString().slice(0, 16))
      setDefaultAllDone(true)
    }
  }, [open, editing])

  async function save() {
    if (!title.trim()) { toast.warn('请填写作业标题'); return }
    setSaving(true)
    try {
      const baseData = {
        title: title.trim(), subject, description: description.trim(),
        publishedAt: new Date(publishedAt).toISOString(),
        dueAt: new Date(dueAt).toISOString(),
      }
      if (editing) {
        await assignmentRepo.update(editing.id, baseData as any)
      } else {
        // 默认所有同学都"已交"；之后教师再把异常（缺交/补交）改出来
        const completions: AssignmentCompletion[] = students.map((s) => ({
          studentId: s.id,
          status: defaultAllDone ? 'submitted' : 'pending',
          submittedAt: defaultAllDone ? new Date().toISOString() : null,
        }))
        await assignmentRepo.create({ classId: cid, ...baseData, completions } as any)
      }
      toast.success('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑作业' : '新建作业'} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button onClick={save} loading={saving}>保存</Button></>}>
      <div className="p-4 space-y-3">
        <FF label="标题" required><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：牛顿第三定律 课后练习" /></FF>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="科目"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></FF>
          <FF label="发布时间"><input type="datetime-local" className="input" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} /></FF>
          <FF label="截止时间"><input type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></FF>
        </div>
        <FF label="说明"><textarea rows={4} className="input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} /></FF>
        {!editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={defaultAllDone} onChange={(e) => setDefaultAllDone(e.target.checked)} />
            <span>创建时默认全部已交（之后再把缺交 / 补交的学生改出来）</span>
          </label>
        )}
      </div>
    </Modal>
  )
}

function AssignmentReviewModal({ open, assignment, students, onClose, onSaved }: { open: boolean; assignment: Assignment; students: Student[]; onClose: () => void; onSaved: () => void }) {
  const [comps, setComps] = useState<AssignmentCompletion[]>(assignment.completions ?? [])
  useEffect(() => setComps(assignment.completions ?? []), [assignment])

  async function update(studentId: string, status: AssignmentCompletion['status']) {
    const next = comps.map((c) => c.studentId === studentId ? { ...c, status, submittedAt: ['submitted', 'late'].includes(status) ? new Date().toISOString() : null } : c)
    setComps(next)
    await assignmentRepo.update(assignment.id, { completions: next } as any)
    const target = next.find((c) => c.studentId === studentId)!
    await syncAssignmentCompletion(assignment, target)
    toast.success('已更新')
    onSaved()
  }

  async function markAllSubmitted() {
    const next = comps.map((c) => ({ ...c, status: 'submitted' as const, submittedAt: new Date().toISOString() }))
    setComps(next)
    await assignmentRepo.update(assignment.id, { completions: next } as any)
    // 全部已交：清除该作业所有关联记录
    await clearAssignmentRecords(assignment.id)
    toast.success('已全部标记为已交')
    onSaved()
  }

  const map = new Map(comps.map((c) => [c.studentId, c]))
  const submittedCount = comps.filter((c) => c.status === 'submitted' || c.status === 'late').length
  return (
    <Modal open={open} onClose={onClose} title={`完成情况 · ${assignment.title}`} size="lg"
      footer={<Button variant="ghost" onClick={onClose}>关闭</Button>}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-soft">已交 {submittedCount} / {students.length}</span>
          <Button size="sm" variant="outline" onClick={markAllSubmitted}><Check size={13} /> 一键全部已交</Button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="data">
            <thead><tr><th>学生</th><th>状态</th><th className="text-right">操作</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const c = map.get(s.id) || { studentId: s.id, status: 'pending' as const }
                return (
                  <tr key={s.id}>
                    <td>{s.name} <span className="text-soft text-xs font-mono ml-1">{s.studentNo}</span></td>
                    <td><Tag tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Tag></td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => update(s.id, 'submitted')} className="px-2 py-1 text-xs rounded text-ink-700 hover:bg-ink-100 inline-flex items-center gap-1"><Check size={12} /> 已交</button>
                        <button onClick={() => update(s.id, 'late')} className="px-2 py-1 text-xs rounded text-amber-700 hover:bg-amber-50">补交</button>
                        <button onClick={() => update(s.id, 'missing')} className="px-2 py-1 text-xs rounded text-red-600 hover:bg-red-50 inline-flex items-center gap-1"><X size={12} /> 缺交</button>
                        <button onClick={() => update(s.id, 'exempt')} className="px-2 py-1 text-xs rounded text-soft hover:bg-ink-100">免交</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

function FF({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <div className="text-xs text-soft mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</div>
      {children}
    </div>
  )
}
