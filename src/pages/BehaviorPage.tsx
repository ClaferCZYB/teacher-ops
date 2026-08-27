/**
 * 日常表现与德育 — 加减分、积分排名、小组排名
 * 用 record 表实现（type: 'reward' / 'demerit' / 'award' / 'punish'）
 */
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { ScoreInline } from '@/components/ScoreBadge'
import { classRepo, studentRepo, recordRepo } from '@/db/repositories'
import type { ClassEntity, Student, StudentRecord } from '@/types/models'
import { RECORD_TYPE_LABEL } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import { formatDate, cn } from '@/utils/helpers'
import { Plus, Trophy, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { isPositiveType, defaultScoreForType, validateScoreForType } from '@/utils/scoring'

export function BehaviorPage() {
  const navigate = useNavigate()
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<{ studentId?: string; type: 'reward' | 'demerit' }>({ type: 'reward' })

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && cls.length) setCid(cls[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) return setStudents([]); setRecords([])
      const s = await studentRepo.listByClass(cid)
      const r = await recordRepo.listByClass(cid)
      // 纳入考勤/作业自动同步的扣分记录（type 为 attendance / behavior）
      const SCORING_TYPES = ['reward', 'demerit', 'award', 'punish', 'attendance', 'behavior']
      setStudents(s); setRecords(r.filter((x) => SCORING_TYPES.includes(x.type)))
    })()
  }, [cid])

  const scoreMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of records) m.set(r.studentId, (m.get(r.studentId) ?? 0) + (r.score ?? 0))
    return m
  }, [records])

  const ranked = useMemo(() => {
    return students
      .map((s) => ({ student: s, score: scoreMap.get(s.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }, [students, scoreMap])

  return (
    <div>
      <PageHeader
        title="日常表现"
        description="奖励、扣分、积分排名（班主任班）"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button onClick={() => { setPreset({ type: 'reward' }); setOpen(true) }}>
              <Plus size={14} /> 加分
            </Button>
          </>
        }
      />

      {!cid ? <Empty title="请选择班级" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy size={14} /> 学生积分排名</h3>
              <Button size="sm" variant="ghost" onClick={() => { setPreset({ type: 'demerit' }); setOpen(true) }}>+ 扣分</Button>
            </div>
            <table className="data">
              <thead><tr><th>#</th><th>姓名</th><th className="hidden sm:table-cell">学号</th><th>积分</th><th className="hidden sm:table-cell">记录数</th><th className="text-right">操作</th></tr></thead>
              <tbody>
                {ranked.map((r, i) => {
                  const rcount = records.filter((x) => x.studentId === r.student.id).length
                  return (
                    <tr key={r.student.id}>
                      <td className="text-soft font-mono">{i + 1}</td>
                      <td><button onClick={() => navigate(`/students/${r.student.id}`)} className="text-ink-900 hover:underline">{r.student.name}</button></td>
                      <td className="hidden sm:table-cell font-mono text-soft">{r.student.studentNo}</td>
                      <td><ScoreInline score={r.score} strong={r.score > 0} /></td>
                      <td className="hidden sm:table-cell text-soft">{rcount}</td>
                      <td className="text-right">
                        <Button size="sm" variant="outline" onClick={() => { setPreset({ studentId: r.student.id, type: 'reward' }); setOpen(true) }}>+加分</Button>
                      </td>
                    </tr>
                  )
                })}
                {ranked.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-6 text-soft text-sm">还没有记录</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Users size={14} /> 最近动态</h3>
            {records.length === 0 ? <div className="text-xs text-soft text-center py-6">暂无</div> : (
              <ul className="space-y-2">
                {records.slice(0, 12).map((r) => {
                  const stu = students.find((s) => s.id === r.studentId)
                  return (
                    <li key={r.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <Tag tone={r.score && r.score > 0 ? 'good' : r.score && r.score < 0 ? 'bad' : 'neutral'}>{RECORD_TYPE_LABEL[r.type]}</Tag>
                        <span className="text-soft">{formatDate(r.occurredAt)}</span>
                        <ScoreInline score={r.score} strong={r.type === 'award' || r.type === 'demerit'} />
                      </div>
                      <div className="mt-0.5 truncate">{stu?.name ?? '—'}：{r.content}</div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {open && (
        <BehaviorFormModal
          open
          onClose={() => setOpen(false)}
          cid={cid}
          students={students}
          presetType={preset.type}
          presetStudentId={preset.studentId}
          onSaved={() => {
            setOpen(false)
            void (async () => {
              const r = await recordRepo.listByClass(cid)
              setRecords(r.filter((x) => ['reward', 'demerit', 'award', 'punish'].includes(x.type)))
            })()
          }}
        />
      )}
    </div>
  )
}

interface BehaviorFormProps {
  open: boolean
  onClose: () => void
  cid: string
  students: Student[]
  presetType: 'reward' | 'demerit'
  presetStudentId?: string
  onSaved: () => void
}

function BehaviorFormModal({ open, onClose, cid, students, presetType, presetStudentId, onSaved }: BehaviorFormProps) {
  const [studentId, setStudentId] = useState('')
  const [type, setType] = useState<StudentRecord['type']>(presetType === 'reward' ? 'reward' : 'demerit')
  const [score, setScore] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStudentId(presetStudentId ?? '')
    setType(presetType === 'reward' ? 'reward' : 'demerit')
    setScore(String(defaultScoreForType(presetType === 'reward' ? 'reward' : 'demerit')))
    setContent('')
  }, [open, presetStudentId, presetType])

  async function save() {
    if (!studentId) { toast.warn('请选择学生'); return }
    if (!content.trim()) { toast.warn('请填写说明'); return }
    const n = Number(score)
    const err = validateScoreForType(type, n)
    if (err) { toast.warn(err); return }
    setSaving(true)
    try {
      await recordRepo.create({
        studentId, classId: cid,
        type, score: n,
        occurredAt: new Date().toISOString(),
        content: content.trim(),
        tags: [],
      })
      toast.success('已记录')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={type === 'demerit' || type === 'punish' ? '记录扣分' : '记录加分'} size="md">
      <div className="p-4 space-y-3">
        <div>
          <div className="text-xs text-soft mb-1">类型</div>
          <select className="input" value={type} onChange={(e) => {
            const t = e.target.value as StudentRecord['type']
            setType(t)
            setScore(String(defaultScoreForType(t)))
          }}>
            <optgroup label="加分（非负）">
              <option value="behavior">日常表现</option>
              <option value="growth">成长事件</option>
              <option value="reward">奖励</option>
              <option value="award">荣誉奖项</option>
            </optgroup>
            <optgroup label="扣分（非正）">
              <option value="demerit">处分 / 扣分</option>
              <option value="punish">扣分项</option>
            </optgroup>
          </select>
        </div>
        <div>
          <div className="text-xs text-soft mb-1">学生</div>
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">选择学生</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.studentNo}）</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-soft mb-1">{isPositiveType(type) ? '分值（加分，支持小数）' : '分值（扣分，支持小数）'}</div>
          <input className="input" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder={isPositiveType(type) ? '如 +3（加分）' : '如 -2（扣分）'} />
        </div>
        <div>
          <div className="text-xs text-soft mb-1">说明</div>
          <textarea rows={3} className="input resize-none" value={content} onChange={(e) => setContent(e.target.value)} placeholder="事情经过 / 起因 / 影响" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}
