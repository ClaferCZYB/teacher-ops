/**
 * 教学反思 — 独立模块，按日期 / 章节 / 学期查询
 */
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Tag } from '@/components/Tag'
import { classRepo, reflectionRepo } from '@/db/repositories'
import type { ClassEntity, Reflection } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import { Plus, Edit3, Trash2, FileEdit } from 'lucide-react'
import { formatDate } from '@/utils/helpers'

export function ReflectionsPage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const currentTerm = useUIStore((s) => s.currentTerm)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [chapter, setChapter] = useState('')
  const [list, setList] = useState<Reflection[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Reflection | null>(null)
  const [confirmDel, setConfirmDel] = useState<Reflection | null>(null)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && currentClassId) setCid(currentClassId)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      const all = await reflectionRepo.listAll()
      let r = all
      if (cid) r = r.filter((x) => x.classId === cid)
      if (subject) r = r.filter((x) => x.subject === subject)
      if (chapter) r = r.filter((x) => (x.chapter ?? '').includes(chapter))
      setList(r.sort((a, b) => b.date.localeCompare(a.date)))
    })()
  }, [cid, subject, chapter])

  const subjects = useMemo(() => Array.from(new Set(classes.map((c) => c.subject ?? '物理'))), [classes])

  return (
    <div>
      <PageHeader
        title="教学反思"
        description="长期积累自己的教学反思"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> 新建反思</Button>
        }
      />

      <div className="card p-3 mb-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select className="input" value={cid} onChange={(e) => setCid(e.target.value)}>
          <option value="">全部班级</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">全部科目</option>
          {subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className="input" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="按章节搜索" />
        <div className="text-xs text-soft self-center">{list.length} 条 · 当前学期 {currentTerm ?? '—'}</div>
      </div>

      {list.length === 0 ? <Empty icon={<FileEdit size={18} />} title="还没有教学反思" description="每节课后的反思，长期积累会成为教师成长的最好见证。" />
        : (
          <div className="space-y-2">
            {list.map((r) => (
              <article key={r.id} className="card p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Tag>{r.subject}</Tag>
                      {r.chapter && <Tag tone="info">{r.chapter}</Tag>}
                      <h3 className="text-sm font-medium">{r.title}</h3>
                    </div>
                    <div className="text-xs text-soft mt-0.5">{formatDate(r.date)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(r); setOpen(true) }} className="p-1.5 rounded hover:bg-ink-100 text-soft"><Edit3 size={13} /></button>
                    <button onClick={() => setConfirmDel(r)} className="p-1.5 rounded hover:bg-ink-100 text-red-600"><Trash2 size={13} /></button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-2">{r.content}</p>
                {(r.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags!.map((t) => <Tag key={t}>{t}</Tag>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

      {open && (
        <ReflectionFormModal
          open
          editing={editing}
          cid={cid || classes[0]?.id || ''}
          subjects={subjects.length ? subjects : ['物理']}
          onClose={() => { setOpen(false); setEditing(null) }}
          onSaved={async () => {
            setOpen(false); setEditing(null)
            const all = await reflectionRepo.listAll()
            let r = all
            if (cid) r = r.filter((x) => x.classId === cid)
            if (subject) r = r.filter((x) => x.subject === subject)
            if (chapter) r = r.filter((x) => (x.chapter ?? '').includes(chapter))
            setList(r.sort((a, b) => b.date.localeCompare(a.date)))
          }}
        />
      )}

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} destructive title="删除反思" confirmText="删除"
        onConfirm={async () => {
          if (!confirmDel) return
          await reflectionRepo.softDelete(confirmDel.id)
          toast.success('已删除')
          setList(list.filter((x) => x.id !== confirmDel.id))
        }} />
    </div>
  )
}

function ReflectionFormModal({ open, editing, cid, subjects, onClose, onSaved }: { open: boolean; editing: Reflection | null; cid: string; subjects: string[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [subject, setSubject] = useState('物理')
  const [chapter, setChapter] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDate(editing.date); setSubject(editing.subject); setChapter(editing.chapter ?? '')
      setTitle(editing.title); setContent(editing.content); setTags((editing.tags || []).join('、'))
    } else {
      setDate(new Date().toISOString().slice(0, 10)); setSubject(subjects[0] || '物理')
      setChapter(''); setTitle(''); setContent(''); setTags('')
    }
  }, [open, editing])

  async function save() {
    if (!title.trim()) { toast.warn('请填写标题'); return }
    if (!content.trim()) { toast.warn('请填写反思内容'); return }
    setSaving(true)
    try {
      const data: Partial<Reflection> = {
        date, subject, chapter, title: title.trim(), content: content.trim(),
        tags: tags.split(/[、,，]/).map((x) => x.trim()).filter(Boolean),
        classId: cid || null,
      }
      if (editing) await reflectionRepo.update(editing.id, data)
      else await reflectionRepo.create(data as any)
      toast.success('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑反思' : '新建反思'} size="lg">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="日期"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></FF>
          <FF label="科目"><select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s}>{s}</option>)}</select></FF>
          <FF label="章节"><input className="input" value={chapter} onChange={(e) => setChapter(e.target.value)} /></FF>
        </div>
        <FF label="标题" required><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></FF>
        <FF label="内容" required><textarea rows={6} className="input resize-none" value={content} onChange={(e) => setContent(e.target.value)} /></FF>
        <FF label="标签" hint="用、或者逗号分隔"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} /></FF>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function FF({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <div className="text-xs text-soft mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</div>
      {children}
      {hint && <div className="text-2xs text-muted-400 mt-1">{hint}</div>}
    </div>
  )
}
