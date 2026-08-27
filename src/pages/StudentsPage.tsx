/**
 * 学生管理 — 列表、搜索、新增、编辑、删除、Excel 导入
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Tag } from '@/components/Tag'
import { GenderBadge } from '@/components/GenderBadge'
import { classRepo, studentRepo } from '@/db/repositories'
import { importStudentsFromExcel, exportStudentsToExcel, exportStudentsToCSV } from '@/utils/excel'
import { toast } from '@/store/toast'
import { useUIStore } from '@/store/useUIStore'
import type { Student, ClassEntity, Guardian } from '@/types/models'
import { Plus, Search, Edit3, Trash2, Upload, Download, ChevronRight, Filter } from 'lucide-react'
import { cn, formatDate } from '@/utils/helpers'

export function StudentsPage() {
  const navigate = useNavigate()
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [filterClass, setFilterClass] = useState<string>(currentClassId ?? '')
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'studentNo' | 'updatedAt'>('studentNo')
  const [edit, setEdit] = useState<Student | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Student | null>(null)
  const [importPreview, setImportPreview] = useState<Awaited<ReturnType<typeof importStudentsFromExcel>> | null>(null)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!filterClass && cls.length) setFilterClass(cls[0].id)
    const list = filterClass ? await studentRepo.listByClass(filterClass) : await studentRepo.listAll()
    setStudents(list)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClass])

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    let arr = students
    if (k) arr = arr.filter((s) => s.name.toLowerCase().includes(k) || s.studentNo.toLowerCase().includes(k) || (s.tags || []).some((t) => t.toLowerCase().includes(k)))
    arr = arr.slice().sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN')
      if (sortKey === 'studentNo') return a.studentNo.localeCompare(b.studentNo)
      return a.updatedAt < b.updatedAt ? 1 : -1
    })
    return arr
  }, [students, q, sortKey])

  async function pickFileAndImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const cls = await classRepo.listAll()
        const cid = filterClass || cls[0]?.id
        if (!cid) {
          toast.warn('请先创建班级')
          return
        }
        const existing = await studentRepo.listByClass(cid)
        const preview = await importStudentsFromExcel(file, cid, existing)
        setImportPreview(preview)
      } catch (err) {
        toast.error('导入失败', String((err as Error)?.message ?? err))
      }
    }
    input.click()
  }

  async function confirmImport() {
    if (!importPreview) return
    try {
      const rows = importPreview.toCreate.map((r) => ({
        classId: r.classId,
        studentNo: r.studentNo,
        name: r.name,
        gender: r.gender,
        tags: r.tags,
        guardians: r.guardians,
        height: r.height ?? null,
        status: 'active' as const,
      }))
      for (const row of rows) {
        await studentRepo.create(row as any)
      }
      toast.success(`已新增 ${rows.length} 名学生`)
      setImportPreview(null)
      void refresh()
    } catch (e) {
      toast.error('导入失败', String((e as Error)?.message ?? e))
    }
  }

  async function exportXlsx() {
    try {
      await exportStudentsToExcel(filtered, classes)
      toast.success('已导出 Excel')
    } catch (e) {
      toast.error('导出失败', String((e as Error)?.message ?? e))
    }
  }

  async function exportCsv() {
    try {
      exportStudentsToCSV(filtered)
      toast.success('已导出 CSV')
    } catch (e) {
      toast.error('导出失败', String((e as Error)?.message ?? e))
    }
  }

  const currentClass = classes.find((c) => c.id === filterClass)

  return (
    <div>
      <PageHeader
        title="学生"
        description={currentClass ? `${currentClass.name} · ${students.length} 名学生` : `共 ${students.length} 名学生`}
        actions={
          <>
            <Button variant="outline" onClick={pickFileAndImport}>
              <Upload size={14} /> 导入 Excel / CSV
            </Button>
            <Button variant="outline" onClick={exportXlsx}>
              <Download size={14} /> 导出 Excel
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={14} /> 新增学生
            </Button>
          </>
        }
      />

      {/* 班级筛选 / 搜索 / 排序 */}
      <div className="card p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-soft" />
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="input py-1.5 w-auto pr-8">
              <option value="">全部班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索姓名 / 学号 / 标签"
              className="input pl-8"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-soft">排序</span>
            {(['studentNo', 'name', 'updatedAt'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={cn('px-2 py-1 rounded text-xs border', sortKey === k ? 'bg-ink-700 text-paper-50 border-ink-700' : 'bg-white text-soft border-ink-200 hover:bg-ink-50')}
              >
                {k === 'studentNo' ? '学号' : k === 'name' ? '姓名' : '最近编辑'}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="text-xs text-soft hover:text-ink-700 ml-auto">CSV 导出</button>
        </div>
      </div>

      {/* 列表 */}
      {students.length === 0 ? (
        <Empty
          icon={<Filter size={20} />}
          title={classes.length === 0 ? '请先创建班级' : '班级还没有学生'}
          description={classes.length === 0 ? '到"班级"页创建班级后，再来添加学生。' : '通过新增或从 Excel 导入。'}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={pickFileAndImport}><Upload size={14} /> 批量导入</Button>
              <Button onClick={() => setCreating(true)}><Plus size={14} /> 新增学生</Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <Empty icon={<Search size={20} />} title="没有匹配的学生" description="尝试清空搜索词，或切换班级。" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th className="hidden sm:table-cell">性别</th>
                  <th className="hidden md:table-cell">标签</th>
                  <th className="hidden md:table-cell">最近编辑</th>
                  <th className="text-right w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-soft">{s.studentNo}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="text-ink-900 font-medium hover:underline underline-offset-2"
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="hidden sm:table-cell"><GenderBadge gender={s.gender} size="xs" /></td>
                    <td className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(s.tags || []).slice(0, 2).map((t) => <Tag key={t}>{t}</Tag>)}
                        {(s.tags || []).length > 2 && <Tag>+{s.tags.length - 2}</Tag>}
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-soft text-xs">{formatDate(s.updatedAt)}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => navigate(`/students/${s.id}`)} className="px-2 py-1 text-xs rounded text-soft hover:bg-ink-100 inline-flex items-center gap-1">
                          详情 <ChevronRight size={12} />
                        </button>
                        <button onClick={() => setEdit(s)} className="p-1.5 rounded hover:bg-ink-100 text-soft" aria-label="编辑"><Edit3 size={13} /></button>
                        <button onClick={() => setConfirmDel(s)} className="p-1.5 rounded hover:bg-ink-100 text-red-600" aria-label="删除"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新增 / 编辑 */}
      {(creating || edit) && (
        <StudentFormModal
          open
          onClose={() => { setCreating(false); setEdit(null) }}
          initial={edit}
          classes={classes}
          defaultClassId={filterClass || classes[0]?.id || ''}
          onSubmit={async (data) => {
            try {
              if (edit) {
                await studentRepo.update(edit.id, data)
                toast.success('已更新')
              } else {
                await studentRepo.create({ ...data, tags: data.tags ?? [], status: 'active' } as any)
                toast.success('已添加')
              }
              setCreating(false); setEdit(null)
              void refresh()
            } catch (e) {
              toast.error('保存失败', String((e as Error)?.message ?? e))
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        destructive
        title="删除学生"
        description={`"${confirmDel?.name}" 将进入回收站，可恢复或永久删除。`}
        confirmText="移至回收站"
        onConfirm={async () => {
          if (!confirmDel) return
          try {
            await studentRepo.softDelete(confirmDel.id)
            toast.success('已移至回收站')
            void refresh()
          } catch (e) {
            toast.error('操作失败', String((e as Error)?.message ?? e))
          }
        }}
      />

      {/* 导入预览 */}
      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          onClose={() => setImportPreview(null)}
          onConfirm={confirmImport}
        />
      )}
    </div>
  )
}

interface StudentFormProps {
  open: boolean
  onClose: () => void
  initial: Student | null
  classes: ClassEntity[]
  defaultClassId: string
  onSubmit: (s: Partial<Student>) => Promise<void> | void
}

function StudentFormModal({ open, onClose, initial, classes, defaultClassId, onSubmit }: StudentFormProps) {
  const [studentNo, setStudentNo] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Student['gender']>('male')
  const [classId, setClassId] = useState(defaultClassId)
  const [tags, setTags] = useState('')
  const [groupId, setGroupId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guardians, setGuardians] = useState<Guardian[]>([{ name: '', relation: '', phone: '', isPrimary: true }])
  const [height, setHeight] = useState('')
  const [interest, setInterest] = useState('')
  const [note, setNote] = useState('')
  const [tab, setTab] = useState<'basic' | 'contact' | 'note'>('basic')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setStudentNo(initial.studentNo)
      setName(initial.name)
      setGender(initial.gender)
      setClassId(initial.classId)
      setTags((initial.tags || []).join('、'))
      setGroupId(initial.groupId ?? '')
      setBirthDate(initial.birthDate ?? '')
      setGuardians(initial.guardians?.length ? initial.guardians.map((g) => ({ ...g })) : [{ name: '', relation: '', phone: '', isPrimary: true }])
      setHeight(initial.height != null ? String(initial.height) : '')
      setInterest(initial.interest ?? '')
      setNote(initial.note ?? '')
    } else {
      setStudentNo(''); setName(''); setGender('male'); setClassId(defaultClassId); setTags(''); setGroupId('')
      setBirthDate(''); setGuardians([{ name: '', relation: '', phone: '', isPrimary: true }]); setHeight(''); setInterest(''); setNote('')
    }
    setTab('basic')
  }, [open, initial, defaultClassId])

  async function save() {
    if (!name.trim()) { toast.warn('请输入姓名'); return }
    if (!classId) { toast.warn('请选择班级'); return }
    setSaving(true)
    try {
      await onSubmit({
        studentNo: studentNo.trim() || name.slice(0, 1) + Date.now().toString().slice(-4),
        name: name.trim(),
        gender,
        classId,
        tags: tags.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
        groupId: groupId || null,
        birthDate: birthDate || null,
        guardians: guardians.map((g) => ({ ...g, name: g.name.trim() })).filter((g) => g.name),
        height: height ? Number(height) : null,
        interest: interest || undefined,
        note: note || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? `编辑学生 · ${initial.name}` : '新增学生'} size="lg">
      {/* 顶部 tab 切换 */}
      <div className="border-b border-ink-100 px-4 pt-3 flex gap-3">
        {(['basic', 'contact', 'note'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn('px-2 pb-2 text-sm border-b-2 -mb-px', tab === t ? 'border-ink-700 text-ink-900 font-medium' : 'border-transparent text-soft hover:text-ink-700')}
          >
            {t === 'basic' ? '基本信息' : t === 'contact' ? '家长 / 联系' : '教师备注'}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-3">
        {tab === 'basic' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="学号" hint="留空将自动生成">
                <input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} />
              </FormField>
              <FormField label="姓名" required>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <FormField label="性别">
                <select className="input" value={gender} onChange={(e) => setGender(e.target.value as any)}>
                  <option value="male">男</option><option value="female">女</option><option value="other">其他</option>
                </select>
              </FormField>
              <FormField label="所属班级" required>
                <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="出生日期">
                <input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </FormField>
              <FormField label="身高 (cm)">
                <input className="input" type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="如 172" />
              </FormField>
              <FormField label="所在小组">
                <input className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="组名 / 小组ID" />
              </FormField>
              <FormField label="兴趣特长" className="sm:col-span-3">
                <input className="input" value={interest} onChange={(e) => setInterest(e.target.value)} />
              </FormField>
              <FormField label="标签" hint="用逗号或顿号分隔" className="sm:col-span-3">
                <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="如：班委、数学竞赛、需关注" />
              </FormField>
            </div>
          </>
        )}
        {tab === 'contact' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-soft">家长 / 联系人（可添加多位）</span>
              <Button size="sm" variant="ghost" onClick={() => setGuardians([...guardians, { name: '', relation: '', phone: '', isPrimary: guardians.length === 0 }])}>+ 添加家长</Button>
            </div>
            <div className="space-y-2">
              {guardians.map((g, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-3" placeholder="姓名" value={g.name} onChange={(e) => { const n = [...guardians]; n[i] = { ...g, name: e.target.value }; setGuardians(n) }} />
                  <input className="input col-span-3" placeholder="关系" value={g.relation ?? ''} onChange={(e) => { const n = [...guardians]; n[i] = { ...g, relation: e.target.value }; setGuardians(n) }} />
                  <input className="input col-span-3" placeholder="电话" value={g.phone ?? ''} onChange={(e) => { const n = [...guardians]; n[i] = { ...g, phone: e.target.value }; setGuardians(n) }} />
                  <label className="col-span-2 flex items-center gap-1 text-xs text-soft">
                    <input type="radio" name={`g-primary-${initial?.id ?? 'new'}`} checked={!!g.isPrimary} onChange={() => setGuardians(guardians.map((x, j) => ({ ...x, isPrimary: j === i })))} />
                    主联系
                  </label>
                  <button type="button" className="col-span-1 text-soft hover:text-red-600 flex justify-center" onClick={() => setGuardians(guardians.filter((_, j) => j !== i))} aria-label="删除家长"><Trash2 size={14} /></button>
                </div>
              ))}
              {guardians.length === 0 && <div className="text-xs text-soft">尚未添加家长</div>}
            </div>
          </div>
        )}
        {tab === 'note' && (
          <FormField label="教师内部备注" hint="仅教师可见，不对学生公开">
            <textarea rows={6} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录需要长期跟进的细节、性格特点、家庭情况等。" />
          </FormField>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>{initial ? '保存' : '添加'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function FormField({ label, children, hint, required, className }: { label: string; children: React.ReactNode; hint?: string; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-soft mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {children}
      {hint && <div className="text-2xs text-muted-400 mt-1">{hint}</div>}
    </div>
  )
}

interface ImportPreviewModalProps {
  preview: Awaited<ReturnType<typeof importStudentsFromExcel>>
  onClose: () => void
  onConfirm: () => Promise<void> | void
}

function ImportPreviewModal({ preview, onClose, onConfirm }: ImportPreviewModalProps) {
  const [tab, setTab] = useState<'create' | 'exists' | 'invalid'>('create')
  return (
    <Modal open onClose={onClose} title="导入预览" size="lg" description="确认无误后再写入数据库。">
      <div className="px-4 pt-3 flex gap-3 border-b border-ink-100">
        {([
          ['create', `新增 ${preview.toCreate.length}`],
          ['exists', `已存在 ${preview.toUpdate.length + preview.exactMatches.length}`],
          ['invalid', `无法识别 ${preview.invalid.length}`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn('px-2 pb-2 text-sm border-b-2 -mb-px', tab === k ? 'border-ink-700 text-ink-900' : 'border-transparent text-soft')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {tab === 'create' && (
          preview.toCreate.length === 0 ? <div className="text-sm text-soft text-center py-6">无新增</div> : (
            <table className="data">
              <thead><tr><th>学号</th><th>姓名</th><th>性别</th><th>班级</th></tr></thead>
              <tbody>
                {preview.toCreate.map((r, i) => (
                  <tr key={i}><td>{r.studentNo}</td><td>{r.name}</td><td><GenderBadge gender={r.gender} size="xs" /></td><td>{r.classId.slice(0, 6)}</td></tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === 'exists' && (
          (preview.exactMatches.length + preview.toUpdate.length) === 0 ? <div className="text-sm text-soft text-center py-6">无</div> : (
            <table className="data">
              <thead><tr><th>学号</th><th>姓名</th><th>状态</th></tr></thead>
              <tbody>
                {preview.exactMatches.map((r, i) => <tr key={`m-${i}`}><td>{r.studentNo}</td><td>{r.name}</td><td><Tag tone="warn">已存在 · 跳过</Tag></td></tr>)}
                {preview.toUpdate.map((r, i) => <tr key={`u-${i}`}><td>{r.studentNo}</td><td>{r.name}</td><td><Tag tone="info">重复 · 需要处理</Tag></td></tr>)}
              </tbody>
            </table>
          )
        )}
        {tab === 'invalid' && (
          preview.invalid.length === 0 ? <div className="text-sm text-soft text-center py-6">无异常</div> : (
            <table className="data">
              <thead><tr><th>原始数据</th><th>原因</th></tr></thead>
              <tbody>
                {preview.invalid.map((r, i) => (
                  <tr key={i}><td className="font-mono text-2xs">{JSON.stringify(r.row)}</td><td>{r.reason}</td></tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
      <div className="px-4 py-3 border-t border-ink-100 bg-paper-50 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button onClick={onConfirm} disabled={preview.toCreate.length === 0}>
          确认导入 {preview.toCreate.length} 条
        </Button>
      </div>
    </Modal>
  )
}
