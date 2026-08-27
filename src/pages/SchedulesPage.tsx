/**
 * 课程表 — 一周课程安排
 */
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { classRepo, scheduleRepo } from '@/db/repositories'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { ClassEntity, Schedule } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import { Plus, Edit3, Trash2, Calendar as CalIcon } from 'lucide-react'

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']
const FULL_WEEK = ['一', '二', '三', '四', '五', '六', '日', '一', '二', '三']

export function SchedulesPage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [list, setList] = useState<Schedule[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [confirmDel, setConfirmDel] = useState<Schedule | null>(null)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && cls.length) setCid(cls[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) return setList([])
      setList(await scheduleRepo.listAll().then((all) => all.filter((s) => s.classId === cid).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))))
    })()
  }, [cid])

  const grouped = useMemo(() => {
    const g: Record<number, Schedule[]> = {}
    for (const s of list) (g[s.weekday] ||= []).push(s)
    return g
  }, [list])

  return (
    <div>
      <PageHeader
        title="课程表"
        description="按周显示班级课表"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!cid}><Plus size={14} /> 新增课程</Button>
          </>
        }
      />

      {!cid ? <Empty title="请选择班级" />
        : list.length === 0 ? <Empty icon={<CalIcon size={18} />} title="还没有课程" description="把每周固定课表录入到系统。" />
        : (
          <div className="card overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[700px]">
              {WEEKDAY.map((d, idx) => (
                <div key={d} className="border-r border-ink-100 last:border-r-0">
                  <div className="px-2 py-1.5 text-center text-xs text-soft bg-paper-100/60 border-b border-ink-100">星期{d}</div>
                  <div className="p-2 space-y-1.5 min-h-[120px]">
                    {(grouped[idx + 1] ?? []).map((s) => (
                      <div key={s.id} className="rounded-md bg-ink-50 border border-ink-100 p-2 group">
                        <div className="text-2xs text-soft font-mono">{s.startTime}–{s.endTime}</div>
                        <div className="text-sm font-medium mt-0.5">{s.subject}</div>
                        {s.classroom && <div className="text-2xs text-soft mt-0.5">{s.classroom}</div>}
                        {s.content && <div className="text-2xs text-soft mt-1 line-clamp-2">{s.content}</div>}
                        <div className="opacity-0 group-hover:opacity-100 mt-1 flex gap-1">
                          <button onClick={() => { setEditing(s); setOpen(true) }} className="text-2xs text-soft hover:text-ink-700">编辑</button>
                          <button onClick={() => setConfirmDel(s)} className="text-2xs text-red-600">删除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {open && (
        <ScheduleFormModal
          open
          editing={editing}
          cid={cid}
          onClose={() => { setOpen(false); setEditing(null) }}
          onSaved={async () => {
            setOpen(false); setEditing(null)
            setList(await scheduleRepo.listAll().then((all) => all.filter((s) => s.classId === cid).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))))
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        destructive
        title="删除课程"
        confirmText="删除"
        onConfirm={async () => {
          if (!confirmDel) return
          await scheduleRepo.softDelete(confirmDel.id)
          toast.success('已删除')
          setList(list.filter((x) => x.id !== confirmDel.id))
        }}
      />
    </div>
  )
}

interface ScheduleFormProps {
  open: boolean
  editing: Schedule | null
  cid: string
  onClose: () => void
  onSaved: () => void
}

function ScheduleFormModal({ open, editing, cid, onClose, onSaved }: ScheduleFormProps) {
  const [weekday, setWeekday] = useState<Schedule['weekday']>(1)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('08:45')
  const [subject, setSubject] = useState('物理')
  const [classroom, setClassroom] = useState('')
  const [content, setContent] = useState('')
  const [weeks, setWeeks] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setWeekday(editing.weekday); setStartTime(editing.startTime); setEndTime(editing.endTime)
      setSubject(editing.subject); setClassroom(editing.classroom ?? ''); setContent(editing.content ?? '')
      setWeeks(editing.weeks != null ? String(editing.weeks) : '')
    } else {
      setWeekday(1); setStartTime('08:00'); setEndTime('08:45'); setSubject('物理'); setClassroom(''); setContent(''); setWeeks('')
    }
  }, [open, editing])

  async function save() {
    setSaving(true)
    try {
      const data: Partial<Schedule> = {
        classId: cid, weekday, startTime, endTime, subject, classroom, content,
        weeks: weeks ? Number(weeks) : null,
      }
      if (editing) await scheduleRepo.update(editing.id, data)
      else await scheduleRepo.create(data as any)
      toast.success('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑课程' : '新增课程'} size="md">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <FF label="星期">
            <select className="input" value={weekday} onChange={(e) => setWeekday(Number(e.target.value) as any)}>
              {WEEKDAY.map((w, i) => <option key={w} value={i + 1}>星期{w}</option>)}
            </select>
          </FF>
          <FF label="开始"><input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></FF>
          <FF label="结束"><input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></FF>
          <FF label="科目"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></FF>
          <FF label="教室"><input className="input" value={classroom} onChange={(e) => setClassroom(e.target.value)} /></FF>
          <FF label="第几周"><input type="number" min={1} max={30} className="input" value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder="可选" /></FF>
        </div>
        <FF label="内容"><input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="可选 · 教学章节" /></FF>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-soft mb-1">{label}</div>
      {children}
    </div>
  )
}

