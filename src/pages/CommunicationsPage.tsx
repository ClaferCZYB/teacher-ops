/**
 * 家校沟通（按班级 + 按学生）
 */
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { classRepo, studentRepo, communicationRepo } from '@/db/repositories'
import type { ClassEntity, Student, Communication } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/store/toast'
import { Plus, MessageSquare, Phone, MapPin, Edit3, Trash2, Users } from 'lucide-react'
import { formatDate } from '@/utils/helpers'

const CHANNEL_LABEL: Record<Communication['channel'], string> = {
  phone: '电话',
  wechat: '微信',
  inperson: '面谈',
  email: '邮件',
  note: '便条',
  other: '其他',
}

export function CommunicationsPage() {
  const navigate = useNavigate()
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [students, setStudents] = useState<Student[]>([])
  const [list, setList] = useState<Communication[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Communication | null>(null)
  const [confirmDel, setConfirmDel] = useState<Communication | null>(null)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && cls.length) setCid(cls[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) return setStudents([]); setList([])
      const [s, cs] = await Promise.all([studentRepo.listByClass(cid), communicationRepo.listByClass(cid)])
      setStudents(s); setList(cs)
    })()
  }, [cid])

  const byStudent = useMemo(() => {
    const m = new Map<string, Communication[]>()
    for (const c of list) {
      const arr = m.get(c.studentId) ?? []
      arr.push(c)
      m.set(c.studentId, arr)
    }
    return m
  }, [list])

  return (
    <div>
      <PageHeader
        title="家校沟通"
        description="按班级聚合所有家校沟通记录"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!cid}><Plus size={14} /> 新增沟通</Button>
          </>
        }
      />

      {!cid ? <Empty title="请选择班级" />
        : students.length === 0 ? <Empty icon={<Users />} title="班级还没有学生" />
        : list.length === 0 ? <Empty icon={<MessageSquare size={18} />} title="暂无家校沟通" description="记录每一次与家长的接触，时间轴会自动出现在学生详情。" action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> 立即记录</Button>} />
        : (
          <div className="space-y-4">
            {students.map((s) => {
              const comms = byStudent.get(s.id) ?? []
              if (comms.length === 0) return null
              return (
                <section key={s.id} className="card">
                  <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                    <button onClick={() => navigate(`/students/${s.id}?tab=comms`)} className="text-sm font-semibold hover:underline">{s.name}</button>
                    <span className="text-xs text-soft">{comms.length} 条</span>
                  </div>
                  <ul className="divide-y divide-ink-100">
                    {comms.map((c) => (
                      <li key={c.id} className="px-4 py-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs text-soft">{formatDate(c.occurredAt)} · {CHANNEL_LABEL[c.channel]} · {c.parentName}{c.relation ? `（${c.relation}）` : ''}{c.contact ? ` · ${c.contact}` : ''}</div>
                            <h4 className="text-sm font-medium mt-0.5">{c.subject}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditing(c); setOpen(true) }} className="p-1 rounded hover:bg-ink-100 text-soft" aria-label="编辑"><Edit3 size={13} /></button>
                            <button onClick={() => setConfirmDel(c)} className="p-1 rounded hover:bg-ink-100 text-red-600" aria-label="删除"><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mt-1">{c.content}</p>
                        {c.parentFeedback && <p className="text-xs text-soft mt-1">家长反馈：{c.parentFeedback}</p>}
                        {c.followUpAt && !c.followUpDone && (
                          <Tag tone="warn" className="mt-1">待跟进 · {formatDate(c.followUpAt)}</Tag>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

      {open && (
        <CommModal
          open
          editing={editing}
          cid={cid}
          students={students}
          onClose={() => { setOpen(false); setEditing(null) }}
          onSaved={() => {
            setOpen(false); setEditing(null)
            void (async () => {
              const cs = await communicationRepo.listByClass(cid)
              setList(cs)
            })()
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        destructive
        title="删除沟通记录"
        description="该操作将进入回收站。"
        confirmText="删除"
        onConfirm={async () => {
          if (!confirmDel) return
          await communicationRepo.softDelete(confirmDel.id)
          toast.success('已删除')
          const cs = await communicationRepo.listByClass(cid)
          setList(cs)
        }}
      />
    </div>
  )
}

interface CommModalProps {
  open: boolean
  editing: Communication | null
  cid: string
  students: Student[]
  onClose: () => void
  onSaved: () => void
}

function CommModal({ open, editing, cid, students, onClose, onSaved }: CommModalProps) {
  const [studentId, setStudentId] = useState('')
  const [parentName, setParentName] = useState('')
  const [relation, setRelation] = useState('')
  const [contact, setContact] = useState('')
  const [channel, setChannel] = useState<Communication['channel']>('wechat')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [parentFeedback, setParentFeedback] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [occurredAt, setOccurredAt] = useState(formatDate(new Date()))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setStudentId(editing.studentId)
      setParentName(editing.parentName)
      setRelation(editing.relation ?? '')
      setContact(editing.contact ?? '')
      setChannel(editing.channel)
      setSubject(editing.subject)
      setContent(editing.content)
      setParentFeedback(editing.parentFeedback ?? '')
      setFollowUpAt(editing.followUpAt ? formatDate(editing.followUpAt) : '')
      setOccurredAt(formatDate(editing.occurredAt))
    } else {
      setStudentId(''); setParentName(''); setRelation(''); setContact(''); setChannel('wechat'); setSubject(''); setContent(''); setParentFeedback(''); setFollowUpAt('')
      setOccurredAt(formatDate(new Date()))
    }
  }, [open, editing])

  async function save() {
    if (!studentId) { toast.warn('请选择学生'); return }
    if (!subject.trim()) { toast.warn('请填写主题'); return }
    if (!content.trim()) { toast.warn('请填写沟通内容'); return }
    setSaving(true)
    try {
      const data: Partial<Communication> = {
        studentId, classId: cid, parentName: parentName.trim() || '家长',
        relation: relation.trim(), contact: contact.trim(),
        channel, subject: subject.trim(), content: content.trim(),
        parentFeedback: parentFeedback.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
      }
      if (editing) await communicationRepo.update(editing.id, data)
      else await communicationRepo.create(data as any)
      toast.success('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑沟通' : '新增家校沟通'} size="lg">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="学生" required>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">选择学生</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FF>
          <FF label="沟通日期">
            <input type="date" className="input" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </FF>
          <FF label="沟通方式">
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FF>
          <FF label="家长姓名"><input className="input" value={parentName} onChange={(e) => setParentName(e.target.value)} /></FF>
          <FF label="与学生关系"><input className="input" value={relation} onChange={(e) => setRelation(e.target.value)} /></FF>
          <FF label="联系方式"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></FF>
          <FF label="跟进日期"><input type="date" className="input" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} /></FF>
        </div>
        <FF label="沟通主题" required><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></FF>
        <FF label="沟通内容" required><textarea rows={5} className="input resize-none" value={content} onChange={(e) => setContent(e.target.value)} /></FF>
        <FF label="家长反馈"><textarea rows={3} className="input resize-none" value={parentFeedback} onChange={(e) => setParentFeedback(e.target.value)} /></FF>
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

