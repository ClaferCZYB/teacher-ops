/**
 * 学生详情 — 12+ 模块的统一学生档案
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  studentRepo, recordRepo, communicationRepo, attendanceRepo, gradeRepo, examRepo,
  assignmentRepo, classRepo, groupRepo,
} from '@/db/repositories'
import type {
  Student, StudentRecord, Communication, Attendance, Grade, Exam,
  Assignment, ClassEntity, Group, Guardian,
} from '@/types/models'
import { RECORD_TYPE_LABEL, ATTENDANCE_STATUS_LABEL } from '@/types/models'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Tag } from '@/components/Tag'
import { Empty } from '@/components/Empty'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { GenderBadge } from '@/components/GenderBadge'
import { ScoreBadge, ScoreInline } from '@/components/ScoreBadge'
import { toast } from '@/store/toast'
import { useUIStore } from '@/store/useUIStore'
import { formatDate, cn } from '@/utils/helpers'
import {
  ArrowLeft, Edit3, Trash2, Phone, MapPin, Cake, Plus,
  Calendar, ClipboardCheck, MessageSquare, Award, AlertTriangle,
  TrendingUp, Activity, Heart, GraduationCap, Tag as TagIcon, Clock,
} from 'lucide-react'

type SectionKey =
  | 'overview'   // 基本信息
  | 'study'      // 学业
  | 'physics'    // 物理成绩
  | 'records'    // 成长记录（除家校/考勤）
  | 'attendance' // 考勤
  | 'talks'      // 谈话
  | 'comms'      // 家校沟通
  | 'rewards'    // 奖惩
  | 'note'       // 教师评价
  | 'tags'       // 标签
  | 'timeline'   // 时间轴

const SECTIONS: Array<{ key: SectionKey; label: string; icon: import("lucide-react").LucideIcon }> = [
  { key: 'overview', label: '基本信息', icon: GraduationCap },
  { key: 'study', label: '学业', icon: TrendingUp },
  { key: 'physics', label: '物理成绩', icon: Activity },
  { key: 'records', label: '成长记录', icon: Heart },
  { key: 'attendance', label: '考勤', icon: ClipboardCheck },
  { key: 'talks', label: '谈话记录', icon: MessageSquare },
  { key: 'comms', label: '家校沟通', icon: MessageSquare },
  { key: 'rewards', label: '奖惩', icon: Award },
  { key: 'note', label: '教师评价', icon: Edit3 },
  { key: 'tags', label: '标签', icon: TagIcon },
  { key: 'timeline', label: '时间轴', icon: Clock },
]

export function StudentDetailPage() {
  const { id = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as SectionKey | null) ?? 'overview'
  const navigate = useNavigate()

  const [student, setStudent] = useState<Student | null>(null)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [comms, setComms] = useState<Communication[]>([])
  const [att, setAtt] = useState<Attendance[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const openQR = useUIStore((s) => s.openQuickRecord)

  async function loadAll() {
    if (!id) return
    const s = await studentRepo.findById(id)
    setStudent(s)
    if (!s) return
    const [cls, gps] = await Promise.all([
      classRepo.listAll(),
      groupRepo.listByClass(s.classId),
    ])
    setClasses(cls)
    setGroups(gps)
    const [recs, cs, ats, gs, exs, assigns] = await Promise.all([
      recordRepo.listByStudent(id),
      communicationRepo.listByStudent(id),
      attendanceRepo.listByStudent(id),
      gradeRepo.listByStudent(id),
      examRepo.listAll(),
      assignmentRepo.listAll(),
    ])
    setRecords(recs)
    setComms(cs)
    setAtt(ats)
    setGrades(gs)
    setExams(exs)
    setAssignments(assigns)
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!student) {
    return <Empty title="学生不存在" description="可能已被删除。回到学生列表。" action={<Button onClick={() => navigate('/students')}>返回</Button>} />
  }

  const enrollClass = classes.find((c) => c.id === student.classId)
  const group = groups.find((g) => g.id === student.groupId)
  const examMap = new Map(exams.map((e) => [e.id, e]))

  return (
    <div className="space-y-4">
      {/* 顶部 */}
      <div className="card overflow-hidden">
        <div className="px-4 py-4 sm:px-5 sm:py-5 flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded hover:bg-ink-100 text-soft" aria-label="返回">
            <ArrowLeft size={16} />
          </button>
          <div className="w-12 h-12 rounded-full bg-ink-700 text-paper-50 flex items-center justify-center text-lg font-medium shrink-0">
            {student.name.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-semibold text-ink-900 truncate">{student.name}</h1>
              <GenderBadge gender={student.gender} />
              <Tag tone="info">{enrollClass?.name ?? student.classId.slice(0, 6)}</Tag>
            </div>
            <div className="text-xs text-soft mt-1 flex flex-wrap gap-3">
              <span className="font-mono">学号：{student.studentNo}</span>
              {group && <span>小组：{group.name}</span>}
              {student.seatRow && <span>座位：第{student.seatRow}排第{student.seatCol}列</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" onClick={() => openQR({ studentId: student.id, classId: student.classId })}>
              <Plus size={14} /> 记录
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)} aria-label="编辑"><Edit3 size={14} /></Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-600"><Trash2 size={14} /></Button>
          </div>
        </div>
      </div>

      {/* 子菜单 */}
      <div className="card p-2 overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const active = tab === s.key
            return (
              <button
                key={s.key}
                onClick={() => setSearchParams({ tab: s.key })}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors',
                  active ? 'bg-ink-700 text-paper-50' : 'text-soft hover:bg-ink-100',
                )}
              >
                <Icon size={12} /> {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {tab === 'overview' && <Overview student={student} classes={classes} group={group} />}
          {tab === 'study' && <StudySummary student={student} grades={grades} exams={exams} />}
          {tab === 'physics' && <PhysicsTab student={student} grades={grades} exams={exams} />}
          {tab === 'records' && <RecordList records={records.filter((r) => !['home', 'talk', 'attendance', 'behavior', 'reward', 'demerit', 'award', 'punish'].includes(r.type))} onChange={loadAll} />}
          {tab === 'attendance' && <AttendanceList att={att} />}
          {tab === 'talks' && <TalksList records={records.filter((r) => r.type === 'talk')} onChange={loadAll} />}
          {tab === 'comms' && <CommsList comms={comms} student={student} onChange={loadAll} />}
          {tab === 'rewards' && <RewardsList records={records.filter((r) => ['reward', 'demerit', 'award', 'punish', 'attendance', 'behavior'].includes(r.type))} onChange={loadAll} />}
          {tab === 'note' && <NoteSection student={student} onSaved={loadAll} />}
          {tab === 'tags' && <TagsSection student={student} onChange={loadAll} />}
          {tab === 'timeline' && <Timeline studentId={student.id} onChange={loadAll} />}
        </div>
        <div className="space-y-4">
          <div className="card p-3">
            <div className="text-xs text-soft mb-2 flex items-center gap-1.5"><Heart size={12} /> 快速操作</div>
            <div className="space-y-1.5">
              <Button block variant="outline" onClick={() => openQR({ studentId: student.id, classId: student.classId })}>
                <Plus size={14} /> 快速记录
              </Button>
              <Button block variant="outline" onClick={() => setSearchParams({ tab: 'comms' })}>
                <MessageSquare size={14} /> 新增家校沟通
              </Button>
              <Button block variant="outline" onClick={() => setSearchParams({ tab: 'attendance' })}>
                <ClipboardCheck size={14} /> 记录考勤
              </Button>
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-soft mb-2 flex items-center gap-1.5"><Activity size={12} /> 关键计数</div>
            <ul className="text-xs space-y-1">
              <Row label="成长记录" value={records.filter((r) => !['attendance', 'home'].includes(r.type)).length} />
              <Row label="家校沟通" value={comms.length} />
              <Row label="考勤异常" value={att.filter((a) => a.status !== 'present').length} />
              <Row label="考试记录" value={grades.length} />
            </ul>
          </div>
        </div>
      </div>

      {editing && (
        <EditStudentModal
          open
          student={student}
          classes={classes}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void loadAll() }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        destructive
        title="删除学生"
        description={`将「${student.name}」移至回收站，可在回收站恢复。`}
        confirmText="移至回收站"
        onConfirm={async () => {
          await studentRepo.softDelete(student.id)
          toast.success('已移至回收站')
          navigate('/students')
        }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return <li className="flex items-center justify-between"><span className="text-soft">{label}</span><span className="font-medium">{value}</span></li>
}

function Overview({ student, classes, group }: { student: Student; classes: ClassEntity[]; group: Group | undefined }) {
  const c = classes.find((x) => x.id === student.classId)
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3">基本信息</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Item k="姓名" v={student.name} />
        <Item k="学号" v={<span className="font-mono">{student.studentNo}</span>} />
        <Item k="性别" v={<GenderBadge gender={student.gender} />} />
        <Item k="所在班级" v={`${c?.name ?? '—'} (${c?.grade ?? ''})`} />
        <Item k="小组" v={group?.name ?? '—'} />
        <Item k="座位" v={student.seatRow ? `第${student.seatRow}排 第${student.seatCol}列` : '—'} />
        <Item k="身高" v={student.height != null ? `${student.height} cm` : '—'} icon={<TrendingUp size={12} />} />
        <Item k="出生日期" v={student.birthDate ? `${student.birthDate} (${student.birthDate ? new Date(student.birthDate).toLocaleDateString() : ''})` : '—'} icon={<Cake size={12} />} />
        <Item k="家长 / 联系人" className="sm:col-span-2" v={
          student.guardians?.length ? (
            <ul className="space-y-0.5">
              {student.guardians.map((g, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {g.name}
                  {g.relation && <span className="text-soft">（{g.relation}）</span>}
                  {g.isPrimary && <Tag tone="info" className="!py-0 !px-1.5 text-2xs">主联系</Tag>}
                  {g.phone && <a href={`tel:${g.phone}`} className="text-ink-700 underline"><Phone size={11} className="inline" /> {g.phone}</a>}
                </li>
              ))}
            </ul>
          ) : '—'
        } />
        <Item k="兴趣特长" v={student.interest ?? '—'} />
        <Item k="地址" v={student.address ?? '—'} icon={<MapPin size={12} />} className="sm:col-span-2" />
        <Item k="创建时间" v={formatDate(student.createdAt)} />
        <Item k="最近更新" v={formatDate(student.updatedAt)} />
      </dl>
    </section>
  )
}

function Item({ k, v, icon, className }: { k: string; v: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-2xs text-soft flex items-center gap-1">
        {icon} {k}
      </dt>
      <dd className="text-ink-900 mt-0.5">{v ?? '—'}</dd>
    </div>
  )
}

function StudySummary({ grades, exams }: { student: Student; grades: Grade[]; exams: Exam[] }) {
  const map = new Map(exams.map((e) => [e.id, e]))
  const sorted = grades.slice().sort((a, b) => {
    const ea = map.get(a.examId)
    const eb = map.get(b.examId)
    return (ea?.examDate ?? '') > (eb?.examDate ?? '') ? -1 : 1
  })
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><TrendingUp size={14} /> 学业成绩（所有学科）</h2>
      {sorted.length === 0 ? <Empty icon={<TrendingUp size={18} />} title="暂无考试成绩" /> : (
        <table className="data">
          <thead><tr><th>考试</th><th>学科</th><th>分数</th><th>排名</th><th>日期</th></tr></thead>
          <tbody>
            {sorted.map((g) => {
              const e = map.get(g.examId)
              return (
                <tr key={g.id}>
                  <td>{e?.name ?? '—'}</td>
                  <td>{g.subject}</td>
                  <td><span className="font-medium">{g.score}</span>{e?.fullScore ? ` / ${e.fullScore}` : ''}</td>
                  <td>{g.rank ?? '—'}</td>
                  <td className="text-soft text-xs">{formatDate(e?.examDate)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

function PhysicsTab({ student, grades, exams }: { student: Student; grades: Grade[]; exams: Exam[] }) {
  const map = new Map(exams.map((e) => [e.id, e]))
  const physics = grades.filter((g) => g.subject === '物理' || g.subject === 'physics')
  const kpMap = new Map<string, number>()
  for (const g of physics) {
    const kps = (g.knowledgePoints ?? '').split(/[,,、;；\s]+/).filter(Boolean)
    for (const k of kps) kpMap.set(k, (kpMap.get(k) ?? 0) + 1)
  }
  const knowledgeStats = Array.from(kpMap.entries()).sort((a, b) => b[1] - a[1])
  return (
    <section className="card p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-1.5"><Activity size={14} /> 物理学科</h2>
      <div>
        <h3 className="text-xs text-soft mb-2">考试记录</h3>
        {physics.length === 0 ? <Empty icon={<Activity size={18} />} title="还没有物理考试成绩" /> : (
          <table className="data">
            <thead><tr><th>考试</th><th>分数</th><th>排名</th><th>知识点</th><th>日期</th></tr></thead>
            <tbody>
              {physics.map((g) => (
                <tr key={g.id}>
                  <td>{map.get(g.examId)?.name}</td>
                  <td><span className="font-medium">{g.score}</span></td>
                  <td>{g.rank ?? '—'}</td>
                  <td className="text-xs text-soft truncate max-w-[200px]">{g.knowledgePoints || '—'}</td>
                  <td className="text-xs text-soft">{formatDate(map.get(g.examId)?.examDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3 className="text-xs text-soft mb-2">知识点出现频次</h3>
        {knowledgeStats.length === 0 ? (
          <div className="text-xs text-soft">尚无知识点记录，可在"成绩"页录入。</div>
        ) : (
          <ul className="space-y-1 text-xs">
            {knowledgeStats.map(([k, n]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="flex-1 truncate">{k}</span>
                <span className="text-soft">×{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function RecordList({ records, onChange }: { records: StudentRecord[]; onChange: () => void | Promise<void> }) {
  if (records.length === 0) return <Empty icon={<Heart size={18} />} title="还没有成长记录" description="点击右上角「记录」按钮快速创建。" />
  return (
    <section className="card divide-y divide-ink-100">
      {records.map((r) => (
        <article key={r.id} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag tone="neutral">{RECORD_TYPE_LABEL[r.type]}</Tag>
              <span className="text-xs text-soft">{formatDate(r.occurredAt)}</span>
            </div>
            <button onClick={async () => {
              if (!confirm('删除该记录？将进入回收站。')) return
              await recordRepo.softDelete(r.id)
              toast.success('已移至回收站')
              void onChange()
            }} className="p-1 rounded text-red-600 hover:bg-ink-100" aria-label="删除"><Trash2 size={13} /></button>
          </div>
          {r.title && <h4 className="text-sm font-medium mt-1.5">{r.title}</h4>}
          <p className="text-sm text-ink-900 whitespace-pre-wrap mt-1">{r.content}</p>
          {r.score != null && <div className="mt-1 text-xs text-soft">分值：{r.score}</div>}
        </article>
      ))}
    </section>
  )
}

function AttendanceList({ att }: { att: Attendance[] }) {
  if (att.length === 0) return <Empty icon={<ClipboardCheck size={18} />} title="尚无考勤记录" />
  const tally = att.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})
  return (
    <section className="card p-4 space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-1.5"><ClipboardCheck size={14} /> 考勤</h2>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(tally).map(([k, v]) => (
          <Tag key={k} tone={k === 'absent' ? 'bad' : k === 'late' || k === 'early' ? 'warn' : 'neutral'}>{ATTENDANCE_STATUS_LABEL[k as keyof typeof ATTENDANCE_STATUS_LABEL]} ×{v}</Tag>
        ))}
      </div>
      <table className="data">
        <thead><tr><th>日期</th><th>状态</th><th>备注</th></tr></thead>
        <tbody>
          {att.map((a) => (
            <tr key={a.id}>
              <td>{formatDate(a.date)}</td>
              <td>{ATTENDANCE_STATUS_LABEL[a.status]}</td>
              <td className="text-soft">{a.remark ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function TalksList({ records, onChange }: { records: StudentRecord[]; onChange: () => void | Promise<void> }) {
  if (records.length === 0) return <Empty icon={<MessageSquare size={18} />} title="还没有谈话记录" />
  return (
    <section className="card divide-y divide-ink-100">
      {records.map((r) => (
        <article key={r.id} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-soft">{formatDate(r.occurredAt)}</div>
            <button onClick={async () => {
              if (!confirm('删除该谈话记录？')) return
              await recordRepo.softDelete(r.id)
              toast.success('已删除')
              void onChange()
            }} className="p-1 rounded text-red-600 hover:bg-ink-100" aria-label="删除"><Trash2 size={13} /></button>
          </div>
          <p className="text-sm text-ink-900 mt-1 whitespace-pre-wrap">{r.content}</p>
        </article>
      ))}
    </section>
  )
}

function CommsList({ comms, student, onChange }: { comms: Communication[]; student: Student; onChange: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="card">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare size={14} /> 家校沟通</h2>
        <Button onClick={() => setOpen(true)}><Plus size={14} /> 新增</Button>
      </div>
      {comms.length === 0 ? (
        <Empty icon={<MessageSquare size={18} />} title="暂无家校沟通" description="家长来访、微信、电话都可以记录在这里。" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {comms.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-soft">{formatDate(c.occurredAt)} · {c.parentName}{c.relation ? ` (${c.relation})` : ''} · {c.channel}</div>
                <button onClick={async () => {
                  if (!confirm('删除该沟通记录？')) return
                  await communicationRepo.softDelete(c.id)
                  toast.success('已删除')
                  void onChange()
                }} className="p-1 rounded text-red-600 hover:bg-ink-100" aria-label="删除"><Trash2 size={13} /></button>
              </div>
              <h4 className="text-sm font-medium mt-1">{c.subject}</h4>
              <p className="text-sm text-ink-900 whitespace-pre-wrap mt-1">{c.content}</p>
              {c.parentFeedback && <p className="text-xs text-soft mt-1">家长反馈：{c.parentFeedback}</p>}
              {c.followUpAt && !c.followUpDone && <div className="mt-1 text-xs text-amber-700">需跟进：{formatDate(c.followUpAt)}</div>}
            </li>
          ))}
        </ul>
      )}

      {open && <CommFormModal open onClose={() => setOpen(false)} studentId={student.id} classId={student.classId} onSaved={() => { setOpen(false); void onChange() }} />}
    </section>
  )
}

function CommFormModal({ open, onClose, studentId, classId, onSaved }: { open: boolean; onClose: () => void; studentId: string; classId: string; onSaved: () => void }) {
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

  async function save() {
    if (!subject.trim()) { toast.warn('请填写沟通主题'); return }
    if (!content.trim()) { toast.warn('请填写沟通内容'); return }
    setSaving(true)
    try {
      await communicationRepo.create({
        studentId, classId,
        parentName: parentName.trim() || '家长',
        relation: relation.trim(),
        contact: contact.trim(),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        channel,
        subject: subject.trim(),
        content: content.trim(),
        parentFeedback: parentFeedback.trim(),
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
      } as any)
      toast.success('已记录')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新增家校沟通" size="lg">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="沟通日期"><input className="input" type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} /></FF>
          <FF label="家长姓名"><input className="input" value={parentName} onChange={(e) => setParentName(e.target.value)} /></FF>
          <FF label="与学生关系"><input className="input" placeholder="如：父亲 / 母亲" value={relation} onChange={(e) => setRelation(e.target.value)} /></FF>
          <FF label="联系方式"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></FF>
          <FF label="沟通方式">
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
              <option value="wechat">微信</option>
              <option value="phone">电话</option>
              <option value="inperson">面谈</option>
              <option value="email">邮件</option>
              <option value="note">便条</option>
              <option value="other">其他</option>
            </select>
          </FF>
          <FF label="跟进日期"><input className="input" type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} /></FF>
        </div>
        <FF label="沟通主题" required><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></FF>
        <FF label="沟通内容" required><textarea rows={4} className="input resize-none" value={content} onChange={(e) => setContent(e.target.value)} /></FF>
        <FF label="家长反馈"><textarea rows={3} className="input resize-none" value={parentFeedback} onChange={(e) => setParentFeedback(e.target.value)} /></FF>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function RewardsList({ records, onChange }: { records: StudentRecord[]; onChange: () => void | Promise<void> }) {
  const tally = records.reduce<Record<string, { count: number; score: number }>>((acc, r) => {
    const k = r.type
    acc[k] ||= { count: 0, score: 0 }
    acc[k].count++
    acc[k].score += r.score ?? 0
    return acc
  }, {})
  return (
    <section className="card p-4 space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-1.5"><Award size={14} /> 奖惩 / 荣誉</h2>
      {records.length === 0 ? <Empty icon={<Award size={18} />} title="尚无奖惩记录" /> : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(tally).map(([k, v]) => (
              <Tag key={k} tone={k.includes('punish') || k.includes('demerit') ? 'bad' : 'good'}>{RECORD_TYPE_LABEL[k as keyof typeof RECORD_TYPE_LABEL]} ×{v.count} (总{v.score})</Tag>
            ))}
          </div>
          <ul className="divide-y divide-ink-100">
            {records.map((r) => (
              <li key={r.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-soft">{formatDate(r.occurredAt)} · {RECORD_TYPE_LABEL[r.type]} {r.score != null ? `· ${r.score > 0 ? '+' : ''}${r.score}` : ''}</div>
                  <button onClick={async () => {
                    if (!confirm('删除？')) return
                    await recordRepo.softDelete(r.id)
                    toast.success('已删除')
                    void onChange()
                  }} className="p-1 rounded text-red-600 hover:bg-ink-100" aria-label="删除"><Trash2 size={13} /></button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.content}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function NoteSection({ student, onSaved }: { student: Student; onSaved: () => void }) {
  const [text, setText] = useState(student.note ?? '')
  const [saving, setSaving] = useState(false)
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Edit3 size={14} /> 教师内部评价</h2>
      <textarea rows={8} className="input resize-none" value={text} onChange={(e) => setText(e.target.value)} placeholder="长期性、整体性的教师评价。仅教师可见。" />
      <div className="mt-2 flex justify-end">
        <Button onClick={async () => {
          setSaving(true)
          try {
            await studentRepo.update(student.id, { note: text })
            toast.success('已保存')
            void onSaved()
          } finally {
            setSaving(false)
          }
        }} loading={saving}>保存</Button>
      </div>
    </section>
  )
}

function TagsSection({ student, onChange }: { student: Student; onChange: () => void | Promise<void> }) {
  const [text, setText] = useState((student.tags || []).join('、'))
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><TagIcon size={14} /> 学生标签</h2>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(student.tags || []).map((t) => <Tag key={t}>{t}</Tag>)}
        {(student.tags || []).length === 0 && <span className="text-xs text-soft">尚无标签</span>}
      </div>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="用、或者逗号分隔" />
      <div className="mt-2 flex justify-end">
        <Button onClick={async () => {
          const tags = text.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
          await studentRepo.update(student.id, { tags })
          toast.success('标签已更新')
          void onChange()
        }}>保存</Button>
      </div>
    </section>
  )
}

function Timeline({ studentId }: { studentId: string; onChange?: () => void | Promise<void> }) {
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [comms, setComms] = useState<Communication[]>([])
  const [att, setAtt] = useState<Attendance[]>([])
  const [filter, setFilter] = useState<'all' | 'study' | 'behavior' | 'comm' | 'growth'>('all')

  useEffect(() => {
    void (async () => {
      const [r, c, a] = await Promise.all([
        recordRepo.listByStudent(studentId),
        communicationRepo.listByStudent(studentId),
        attendanceRepo.listByStudent(studentId),
      ])
      setRecords(r)
      setComms(c)
      setAtt(a)
    })()
  }, [studentId])

  type Event = { ts: string; kind: 'study' | 'behavior' | 'comm' | 'growth' | 'attendance'; label: string; text: string }
  const events: Event[] = useMemo(() => {
    const arr: Event[] = []
    for (const r of records) {
      const kind: Event['kind'] = ['attendance'].includes(r.type) ? 'attendance' :
        ['reward', 'demerit', 'award', 'punish'].includes(r.type) ? 'behavior' :
        r.type === 'home' ? 'comm' :
        r.type === 'talk' ? 'comm' :
        r.type === 'study' ? 'study' :
        'growth'
      if (filter === 'all' || (filter === 'study' && kind === 'study') || (filter === 'behavior' && kind === 'behavior') || (filter === 'comm' && kind === 'comm') || (filter === 'growth' && kind === 'growth') || (kind === 'attendance')) {
        arr.push({
          ts: r.occurredAt,
          kind,
          label: RECORD_TYPE_LABEL[r.type],
          text: r.title || r.content,
        })
      }
    }
    for (const c of comms) {
      if (filter !== 'all' && filter !== 'comm') continue
      arr.push({ ts: c.occurredAt, kind: 'comm', label: `家校沟通 · ${c.parentName}`, text: c.subject + ' · ' + c.content })
    }
    for (const a of att) {
      if (filter !== 'all') continue
      if (a.status === 'present') continue
      arr.push({ ts: `${a.date}T00:00:00`, kind: 'attendance', label: `考勤 · ${ATTENDANCE_STATUS_LABEL[a.status]}`, text: a.remark ?? '' })
    }
    return arr.sort((a, b) => a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0)
  }, [records, comms, att, filter])

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><Clock size={14} /> 学生成长时间轴</h2>
        <div className="flex gap-1 flex-wrap">
          {([
            ['all', '全部'],
            ['study', '学业'],
            ['behavior', '行为'],
            ['comm', '沟通'],
            ['growth', '成长'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn('px-2 py-1 rounded text-xs border', filter === k ? 'bg-ink-700 text-paper-50 border-ink-700' : 'bg-white text-soft border-ink-200 hover:bg-ink-50')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {events.length === 0 ? (
        <Empty icon={<Clock size={18} />} title="时间轴还没有事件" description="随堂、谈话、家校沟通、考勤、成绩、奖励、扣分都会自动汇总到这里。" />
      ) : (
        <ol className="relative ml-3 border-l-2 border-ink-100">
          {events.map((e, idx) => (
            <li key={idx} className="ml-4 pb-4 relative">
              <span className={cn(
                'absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white',
                e.kind === 'study' && 'bg-sky-500',
                e.kind === 'behavior' && 'bg-amber-500',
                e.kind === 'comm' && 'bg-ink-700',
                e.kind === 'growth' && 'bg-emerald-500',
                e.kind === 'attendance' && 'bg-red-500',
              )} />
              <div className="text-2xs text-soft">{formatDate(e.ts, true)}</div>
              <div className="text-xs mt-0.5"><Tag>{e.label}</Tag></div>
              <div className="text-sm mt-1 break-words">{e.text}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function FF({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-soft mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {children}
    </div>
  )
}

interface EditModalProps {
  open: boolean
  student: Student
  classes: ClassEntity[]
  onClose: () => void
  onSaved: () => void
}

function EditStudentModal({ open, student, classes, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(student.name)
  const [studentNo, setStudentNo] = useState(student.studentNo)
  const [gender, setGender] = useState(student.gender)
  const [classId, setClassId] = useState(student.classId)
  const [tags, setTags] = useState((student.tags || []).join('、'))
  const [guardians, setGuardians] = useState<Guardian[]>(student.guardians?.length ? student.guardians : [{ name: '', relation: '', phone: '', isPrimary: true }])
  const [birthDate, setBirthDate] = useState(student.birthDate ?? '')
  const [height, setHeight] = useState(student.height != null ? String(student.height) : '')
  const [interest, setInterest] = useState(student.interest ?? '')
  const [note, setNote] = useState(student.note ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(student.name); setStudentNo(student.studentNo); setGender(student.gender); setClassId(student.classId)
    setTags((student.tags || []).join('、'))
    setGuardians(student.guardians?.length ? student.guardians.map((g) => ({ ...g })) : [{ name: '', relation: '', phone: '', isPrimary: true }])
    setBirthDate(student.birthDate ?? ''); setHeight(student.height != null ? String(student.height) : '')
    setInterest(student.interest ?? ''); setNote(student.note ?? '')
  }, [open, student])

  async function save() {
    if (!name.trim()) { toast.warn('姓名不能为空'); return }
    setSaving(true)
    try {
      await studentRepo.update(student.id, {
        name: name.trim(),
        studentNo: studentNo.trim() || student.studentNo,
        gender, classId,
        tags: tags.split(/[、,，]/).map((x) => x.trim()).filter(Boolean),
        guardians: guardians.map((g) => ({ ...g, name: g.name.trim() })).filter((g) => g.name),
        height: height ? Number(height) : null,
        birthDate: birthDate || null,
        interest: interest || undefined,
        note: note || undefined,
      })
      toast.success('已保存')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`编辑 · ${student.name}`} size="lg">
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="姓名" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></FF>
          <FF label="学号"><input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} /></FF>
          <FF label="性别">
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value as any)}>
              <option value="male">男</option><option value="female">女</option><option value="other">其他</option>
            </select>
          </FF>
          <FF label="所属班级">
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FF>
          <FF label="出生日期"><input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></FF>
          <FF label="身高 (cm)"><input className="input" type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="如 172" /></FF>
          <FF label="标签"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="用逗号、顿号分隔" /></FF>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-soft">家长 / 联系人</span>
            <Button size="sm" variant="ghost" onClick={() => setGuardians([...guardians, { name: '', relation: '', phone: '', isPrimary: guardians.length === 0 }])}>+ 添加家长</Button>
          </div>
          <div className="space-y-2">
            {guardians.map((g, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input className="input col-span-3" placeholder="姓名" value={g.name} onChange={(e) => { const n = [...guardians]; n[i] = { ...g, name: e.target.value }; setGuardians(n) }} />
                <input className="input col-span-3" placeholder="关系" value={g.relation ?? ''} onChange={(e) => { const n = [...guardians]; n[i] = { ...g, relation: e.target.value }; setGuardians(n) }} />
                <input className="input col-span-3" placeholder="电话" value={g.phone ?? ''} onChange={(e) => { const n = [...guardians]; n[i] = { ...g, phone: e.target.value }; setGuardians(n) }} />
                <label className="col-span-2 flex items-center gap-1 text-xs text-soft">
                  <input type="radio" name={`primary-${student.id}`} checked={!!g.isPrimary} onChange={() => setGuardians(guardians.map((x, j) => ({ ...x, isPrimary: j === i })))} />
                  主联系
                </label>
                <button type="button" className="col-span-1 text-soft hover:text-red-600 flex justify-center" onClick={() => setGuardians(guardians.filter((_, j) => j !== i))} aria-label="删除家长"><Trash2 size={14} /></button>
              </div>
            ))}
            {guardians.length === 0 && <div className="text-xs text-soft">尚未添加家长</div>}
          </div>
        </div>

        <FF label="兴趣特长" className="sm:col-span-3"><input className="input" value={interest} onChange={(e) => setInterest(e.target.value)} /></FF>
        <FF label="教师内部备注"><textarea rows={4} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} /></FF>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}
