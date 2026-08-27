/**
 * 小组管理
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { classRepo, groupRepo, studentRepo } from '@/db/repositories'
import type { ClassEntity, Group, Student } from '@/types/models'
import { toast } from '@/store/toast'
import { useUIStore } from '@/store/useUIStore'
import { Plus, Edit3, Trash2, Users } from 'lucide-react'

export function GroupsPage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [cls, setCls] = useState<ClassEntity[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(currentClassId ?? '')
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)

  async function refresh() {
    const all = await classRepo.listAll()
    setCls(all.filter((c) => c.status === 'active'))
    if (!selectedClassId && all.length) setSelectedClassId(all[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!selectedClassId) return setGroups([]); setStudents([])
      const [g, s] = await Promise.all([groupRepo.listByClass(selectedClassId), studentRepo.listByClass(selectedClassId)])
      setGroups(g); setStudents(s)
    })()
  }, [selectedClassId])

  return (
    <div>
      <PageHeader
        title="小组"
        description="为每个班级维护学习小组"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">选择班级</option>
              {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!selectedClassId}>
              <Plus size={14} /> 新建小组
            </Button>
          </>
        }
      />
      {!selectedClassId ? <Empty title="请选择班级" />
        : groups.length === 0 ? (
          <Empty icon={<Users size={18} />} title="还没有小组" description="按学习、协作或行为分组，便于开展合作学习。" action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus size={14} /> 新建小组</Button>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((g) => {
              const members = students.filter((s) => s.groupId === g.id)
              return (
                <article key={g.id} className="card p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{g.name}</h3>
                    <div className="flex items-center gap-1">
                      <button className="p-1 rounded hover:bg-ink-100 text-soft" onClick={() => { setEditing(g); setOpen(true) }}><Edit3 size={13} /></button>
                      <button className="p-1 rounded hover:bg-ink-100 text-red-600" onClick={async () => {
                        if (!confirm(`删除小组"${g.name}"？`)) return
                        await groupRepo.softDelete(g.id)
                        // 清空原成员的 groupId
                        const prevMembers = students.filter((s) => s.groupId === g.id)
                        for (const m of prevMembers) await studentRepo.update(m.id, { groupId: null })
                        toast.success('已删除')
                        const next = await groupRepo.listByClass(selectedClassId)
                        const nextStds = await studentRepo.listByClass(selectedClassId)
                        setGroups(next); setStudents(nextStds)
                      }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="text-xs text-soft mt-1">{members.length} 名成员</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {members.length === 0 && <span className="text-2xs text-soft">未分配学生</span>}
                    {members.map((m) => (
                      <span key={m.id} className="chip status-neutral">{m.name}</span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        )}

      {open && (
        <GroupFormModal
          open
          initial={editing}
          students={students}
          classId={selectedClassId}
          onClose={() => { setOpen(false); setEditing(null) }}
          onSaved={() => {
            setOpen(false); setEditing(null)
            void (async () => {
              const next = await groupRepo.listByClass(selectedClassId)
              const nextStds = await studentRepo.listByClass(selectedClassId)
              setGroups(next); setStudents(nextStds)
            })()
          }}
        />
      )}
    </div>
  )
}

interface GroupFormProps {
  open: boolean
  initial: Group | null
  students: Student[]
  classId: string
  onClose: () => void
  onSaved: () => void
}

function GroupFormModal({ open, initial, students, classId, onClose, onSaved }: GroupFormProps) {
  const [name, setName] = useState('')
  const [leaderId, setLeaderId] = useState<string>('')
  const [members, setMembers] = useState<string[]>([])
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setLeaderId(initial.leaderId ?? '')
      setNote(initial.note ?? '')
      setMembers(students.filter((s) => s.groupId === initial.id).map((s) => s.id))
    } else {
      setName(''); setLeaderId(''); setNote(''); setMembers([])
    }
  }, [open, initial, students])

  async function save() {
    if (!name.trim()) { toast.warn('请填写组名'); return }
    let groupId: string
    if (initial) {
      groupId = initial.id
      await groupRepo.update(initial.id, { name: name.trim(), leaderId: leaderId || null, note })
    } else {
      const created = await groupRepo.create({ classId, name: name.trim(), leaderId: leaderId || null, note } as any)
      groupId = created.id
    }

    // 同步成员：先清掉之前属于该组的所有学生的 groupId，再把当前选中的标记为本组
    const prevMembers = initial
      ? students.filter((s) => s.groupId === initial.id).map((s) => s.id)
      : []
    for (const id of prevMembers) {
      if (!members.includes(id)) await studentRepo.update(id, { groupId: null })
    }
    for (const id of members) {
      await studentRepo.update(id, { groupId })
    }
    toast.success('已保存')
    onSaved()
  }

  async function toggleMember(id: string) {
    setMembers((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '编辑小组' : '新建小组'} size="md">
      <div className="p-4 space-y-3">
        <div>
          <div className="text-xs text-soft mb-1">组名 *</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-soft mb-1">组长</div>
          <select className="input" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
            <option value="">不指定</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.studentNo}）</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-soft mb-1">成员</div>
          <div className="max-h-60 overflow-y-auto border border-ink-100 rounded-md divide-y divide-ink-100">
            {students.map((s) => {
              const checked = members.includes(s.id)
              return (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-ink-50">
                  <input type="checkbox" checked={checked} onChange={() => toggleMember(s.id)} />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-2xs text-soft font-mono">{s.studentNo}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <div className="text-xs text-soft mb-1">备注</div>
          <textarea rows={2} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}
