/**
 * 班级事务（班主任）— 班会 / 活动 / 通知 / 值日 / 班委 / 班级任务 / 荣誉 / 资料
 */
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { classRepo, classAffairRepo } from '@/db/repositories'
import type { ClassEntity, ClassAffair, ClassAffairType } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import { Plus, Edit3, Trash2, MessageSquare, Trophy, Bell, Calendar, ListTodo, Users } from 'lucide-react'
import { formatDate } from '@/utils/helpers'

const TYPE_LABEL: Record<ClassAffairType, string> = {
  meeting: '班会',
  activity: '活动',
  notice: '通知',
  duty: '值日',
  committee: '班委',
  task: '班级任务',
  honor: '荣誉',
  material: '资料',
  other: '其他',
}

const TYPE_ICON: Record<ClassAffairType, any> = {
  meeting: Calendar, activity: Trophy, notice: Bell, duty: ListTodo,
  committee: Users, task: ListTodo, honor: Trophy, material: MessageSquare, other: MessageSquare,
}

export function ClassAffairsPage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [list, setList] = useState<ClassAffair[]>([])
  const [tab, setTab] = useState<ClassAffairType | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClassAffair | null>(null)
  const [confirmDel, setConfirmDel] = useState<ClassAffair | null>(null)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && cls.length) setCid(cls[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) return setList([])
      setList(await classAffairRepo.listByClass(cid))
    })()
  }, [cid])

  const filtered = useMemo(() => {
    if (tab === 'all') return list
    return list.filter((x) => x.type === tab)
  }, [list, tab])

  return (
    <div>
      <PageHeader
        title="班级事务"
        description="班会 / 活动 / 通知 / 班委 等班主任专属"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!cid}><Plus size={14} /> 新建事务</Button>
          </>
        }
      />

      <div className="card p-2 mb-3 flex items-center gap-1 overflow-x-auto hide-scrollbar">
        {(['all', ...Object.entries(TYPE_LABEL).map(([k]) => k)] as Array<ClassAffairType | 'all'>).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap border ${tab === k ? 'bg-ink-700 text-paper-50 border-ink-700' : 'bg-white text-soft border-ink-200 hover:bg-ink-50'}`}
          >
            {k === 'all' ? '全部' : TYPE_LABEL[k as ClassAffairType]}
          </button>
        ))}
      </div>

      {!cid ? <Empty title="请选择班级" />
        : filtered.length === 0 ? <Empty title="暂无事务" description="把班会的要点、活动安排、班委分工都在这里统一管理。" />
        : (
          <div className="space-y-2">
            {filtered.map((x) => {
              const Icon = TYPE_ICON[x.type]
              return (
                <article key={x.id} className="card p-3 flex items-start gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-md bg-ink-100 text-ink-700 flex items-center justify-center">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag>{TYPE_LABEL[x.type]}</Tag>
                      <h3 className="text-sm font-medium text-ink-900">{x.title}</h3>
                      {x.date && <span className="text-xs text-soft">{formatDate(x.date)}</span>}
                    </div>
                    {x.content && <p className="text-sm text-soft whitespace-pre-wrap mt-1">{x.content}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(x); setOpen(true) }} className="p-1.5 rounded hover:bg-ink-100 text-soft"><Edit3 size={13} /></button>
                    <button onClick={() => setConfirmDel(x)} className="p-1.5 rounded hover:bg-ink-100 text-red-600"><Trash2 size={13} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

      {open && (
        <AffairFormModal
          open
          editing={editing}
          cid={cid}
          onClose={() => { setOpen(false); setEditing(null) }}
          onSaved={() => {
            setOpen(false); setEditing(null)
            void (async () => setList(await classAffairRepo.listByClass(cid)))()
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        destructive
        title="删除事务"
        confirmText="删除"
        onConfirm={async () => {
          if (!confirmDel) return
          await classAffairRepo.softDelete(confirmDel.id)
          toast.success('已删除')
          setList(await classAffairRepo.listByClass(cid))
        }}
      />
    </div>
  )
}

interface AffairFormProps {
  open: boolean
  editing: ClassAffair | null
  cid: string
  onClose: () => void
  onSaved: () => void
}

function AffairFormModal({ open, editing, cid, onClose, onSaved }: AffairFormProps) {
  const [type, setType] = useState<ClassAffairType>('meeting')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<'open' | 'done' | 'archived'>('open')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setType(editing.type); setTitle(editing.title); setContent(editing.content ?? '')
      setDate(editing.date ?? ''); setStatus(editing.status ?? 'open')
    } else {
      setType('meeting'); setTitle(''); setContent(''); setDate(''); setStatus('open')
    }
  }, [open, editing])

  async function save() {
    if (!title.trim()) { toast.warn('请填写标题'); return }
    setSaving(true)
    try {
      const data: Partial<ClassAffair> = {
        type, title: title.trim(), content: content.trim(), date: date || null, status, classId: cid,
      }
      if (editing) await classAffairRepo.update(editing.id, data)
      else await classAffairRepo.create(data as any)
      toast.success('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑事务' : '新建事务'} size="md">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="类型">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ClassAffairType)}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FF>
          <FF label="日期"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></FF>
          <FF label="状态">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="open">进行中</option>
              <option value="done">已完成</option>
              <option value="archived">已归档</option>
            </select>
          </FF>
        </div>
        <FF label="标题" required><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></FF>
        <FF label="内容"><textarea rows={5} className="input resize-none" value={content} onChange={(e) => setContent(e.target.value)} /></FF>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>保存</Button>
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
