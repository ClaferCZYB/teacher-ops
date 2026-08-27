/**
 * 首页工作台：每天打开网站后的工作驾驶舱
 * - 今日信息
 * - 班级概览
 * - 待处理事项
 * - 数据趋势（少量、真实）
 */
import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store/useUIStore'
import {
  classRepo, studentRepo, scheduleRepo, taskRepo, attendanceRepo, recordRepo, assignmentRepo,
} from '@/db/repositories'
import type {
  ClassEntity, Student, Schedule, Task, Attendance, Assignment,
} from '@/types/models'
import { formatDate, isSameDay, startOfDay, endOfDay } from '@/utils/helpers'
import {
  CalendarDays, BookOpen, ListTodo, MessageSquare, ClipboardList,
  GraduationCap, TrendingUp, AlertTriangle, ArrowRight, Plus, Users,
  Trophy,
} from 'lucide-react'

export function DashboardPage() {
  const navigate = useNavigate()
  const currentClassId = useUIStore((s) => s.currentClassId)
  const openQR = useUIStore((s) => s.openQuickRecord)

  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([])
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([])
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([])
  const [followUpCount, setFollowUpCount] = useState(0)

  useEffect(() => {
    void (async () => {
      const cls = await classRepo.listAll()
      setClasses(cls.filter((c) => c.status === 'active'))
      const cid = currentClassId || cls[0]?.id || null

      if (cid) {
        const stds = await studentRepo.listByClass(cid)
        setStudents(stds)
        const schs = await scheduleRepo.listAll()
        const today = new Date().getDay()
        const weekday = ((today === 0 ? 7 : today) as Schedule['weekday']) // 1=Mon...7=Sun; 周日=0 转 7
        setTodaySchedules(schs.filter((s) => s.classId === cid && s.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime)))
        const att = await attendanceRepo.listByClass(cid, formatDate(new Date()), formatDate(new Date()))
        setTodayAttendance(att)

        const assigns = await assignmentRepo.listAll()
        setUpcomingAssignments(assigns.filter((a) => a.classId === cid && new Date(a.dueAt) >= new Date()).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 5))
      }

      const tks = await taskRepo.listOpen()
      setOpenTasks(tks.slice(0, 6))
      const fups = await recordRepo.listUpcomingFollowUp(50)
      setFollowUpCount(fups.length)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClassId])

  const currentClass = classes.find((c) => c.id === currentClassId)
  const totalStudents = students.length
  const todayAttended = todayAttendance.filter((a) => a.status === 'present').length
  const todayAbsent = todayAttendance.filter((a) => a.status === 'absent' || a.status === 'late' || a.status === 'early').length

  return (
    <Fragment>
      <div className="home-bg" aria-hidden>
        <span className="orb-a" />
        <span className="orb-b" />
        <span className="orb-c" />
      </div>
      <div className="space-y-6">
      {/* 顶部 */}
      <section className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-4 sm:py-5 bg-gradient-to-br from-ink-700 to-ink-800 text-paper-50">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs text-paper-200/80 flex items-center gap-1.5">
                <CalendarDays size={12} />
                {formatDate(new Date(), false)} · {weekdayCN()}
              </div>
              <h1 className="text-lg sm:text-xl font-semibold mt-1">欢迎回来</h1>
              <p className="text-xs sm:text-sm text-paper-200/80 mt-0.5">
                {currentClass
                  ? `当前班级：${currentClass.name}${currentClass.isHomeroom ? '（班主任）' : ''}`
                  : '尚未创建班级，请到"班级"页新建'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={openQR} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-paper-50 text-ink-800 text-sm font-medium hover:bg-paper-100">
                <Plus size={14} /> 快速记录
              </button>
              <button onClick={() => navigate('/tasks')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-paper-200/30 text-paper-50 text-sm font-medium hover:bg-paper-50/10">
                <ListTodo size={14} /> 待办
              </button>
            </div>
          </div>
        </div>
        {/* 关键指标 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-ink-100">
          <Stat label="学生" value={String(totalStudents)} icon={Users} onClick={() => navigate('/students')} />
          <Stat label="今日课程" value={String(todaySchedules.length)} icon={BookOpen} onClick={() => navigate('/schedules')} />
          <Stat label="待办" value={String(openTasks.length)} icon={ListTodo} onClick={() => navigate('/tasks')} />
          <Stat label="跟进" value={String(followUpCount)} icon={MessageSquare} onClick={() => navigate('/students')} />
        </div>
      </section>

      {/* 班级概览 + 待处理 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 班级概览 */}
        <div className="card lg:col-span-2">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">班级概览</div>
              <div className="text-xs text-soft">{currentClass?.name ?? '未选择班级'}</div>
            </div>
            <button onClick={() => navigate('/classes')} className="text-xs text-soft hover:text-ink-700 flex items-center gap-1">
              切换班级 <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-ink-100">
            <Mini label="今日出勤" value={`${todayAttended}/${totalStudents}`} hint={todayAbsent ? `异常 ${todayAbsent}` : '本日尚未考勤'} onClick={() => navigate('/attendance')} />
            <Mini label="学生人数" value={String(totalStudents)} hint="不含已转出" onClick={() => navigate('/students')} />
            <Mini label="待跟进" value={String(followUpCount)} hint="来自历史记录" onClick={() => navigate('/students')} />
          </div>
          {/* 今日课程 */}
          <div className="px-4 py-3 border-t border-ink-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-soft flex items-center gap-1.5">
                <BookOpen size={12} /> 今日课程
              </div>
              <button onClick={() => navigate('/schedules')} className="text-2xs text-soft hover:text-ink-700">课程表 →</button>
            </div>
            {todaySchedules.length === 0 ? (
              <div className="text-xs text-soft py-2">今天没有排课</div>
            ) : (
              <ul className="divide-y divide-ink-100/60 -mx-1">
                {todaySchedules.map((s) => (
                  <li key={s.id} className="px-1 py-2 flex items-center gap-2 text-xs">
                    <span className="w-12 shrink-0 text-soft font-mono">{s.startTime}</span>
                    <span className="w-2 h-2 rounded-full bg-ink-700 shrink-0" />
                    <span className="flex-1 truncate">{s.subject}{s.classroom ? ` · ${s.classroom}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* 待交作业 */}
          <div className="px-4 py-3 border-t border-ink-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-soft flex items-center gap-1.5">
                <ClipboardList size={12} /> 待交作业
              </div>
              <button onClick={() => navigate('/assignments')} className="text-2xs text-soft hover:text-ink-700">作业页 →</button>
            </div>
            {upcomingAssignments.length === 0 ? (
              <div className="text-xs text-soft py-2">近期没有未截止作业</div>
            ) : (
              <ul className="space-y-1.5">
                {upcomingAssignments.slice(0, 3).map((a) => {
                  const due = new Date(a.dueAt)
                  const overdue = due < startOfDay(new Date())
                  const completed = a.completions?.filter((c) => c.status === 'submitted').length ?? 0
                  const all = a.completions?.length ?? 0
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-xs">
                      <ClipboardList size={12} className="text-soft" />
                      <span className="flex-1 truncate">{a.title}</span>
                      <span className={overdue ? 'text-red-600' : 'text-soft'}>
                        {overdue ? '已截止' : formatDate(a.dueAt)} · {completed}/{all || '-'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 待处理事项 */}
        <div className="card">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <div className="text-sm font-semibold">待处理事项</div>
            <button onClick={() => navigate('/tasks')} className="text-xs text-soft hover:text-ink-700">全部 →</button>
          </div>
          <ul className="divide-y divide-ink-100/60">
            {openTasks.length === 0 ? (
              <li className="px-4 py-6 text-xs text-soft text-center">暂无待办</li>
            ) : (
              openTasks.map((t) => (
                <li key={t.id} className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="w-full text-left flex items-start gap-2"
                  >
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-amber-500' : 'bg-ink-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-900 truncate">{t.title}</div>
                      <div className="text-2xs text-soft mt-0.5">
                        {t.dueDate ? `截止 ${formatDate(t.dueDate)}` : '无截止'}
                        {t.classId ? ' · 已关联班级' : ''}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="px-4 py-3 border-t border-ink-100">
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-soft hover:text-ink-700 flex items-center gap-1"
            >
              <ListTodo size={12} /> 管理全部待办
            </button>
          </div>
        </div>
      </section>

      {/* 数据趋势（少量、真实） */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentRecordsCard />
        <RecentCommunicationsCard />
        <PerformanceSnapshotCard />
      </section>
    </div>
    </Fragment>
  )
}

function weekdayCN(): string {
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return w[new Date().getDay()]
}

function Stat({ label, value, icon: Icon, onClick }: { label: string; value: string; icon: import("lucide-react").LucideIcon; onClick?: () => void }) {
  const Wrap: any = onClick ? 'button' : 'div'
  return (
    <Wrap onClick={onClick} className="text-left px-4 py-3 block hover:bg-ink-50/50">
      <div className="text-2xs text-soft flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </div>
      <div className="text-lg font-semibold text-ink-900 mt-0.5">{value}</div>
    </Wrap>
  )
}

function Mini({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick?: () => void }) {
  const Wrap: any = onClick ? 'button' : 'div'
  return (
    <Wrap onClick={onClick} className="text-left px-4 py-3 block hover:bg-ink-50/50">
      <div className="text-xs text-soft">{label}</div>
      <div className="text-xl font-semibold text-ink-900 mt-0.5">{value}</div>
      <div className="text-2xs text-muted-400 mt-0.5">{hint}</div>
    </Wrap>
  )
}

function RecentRecordsCard() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof recordRepo.listByClass>>>([])
  const navigate = useNavigate()
  useEffect(() => {
    void (async () => {
      const cls = await classRepo.listAll()
      const cid = cls[0]?.id
      if (!cid) return setItems([])
      const arr = await recordRepo.listByClass(cid)
      setItems(arr.slice(0, 5))
    })()
  }, [])
  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <div className="text-sm font-semibold">近期学生记录</div>
        <button onClick={() => navigate('/students')} className="text-xs text-soft hover:text-ink-700">查看 →</button>
      </div>
      <div className="px-4 py-3">
        {items.length === 0 ? (
          <div className="text-xs text-soft text-center py-4">暂无</div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <Trophy size={12} className="mt-0.5 text-soft" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{r.content}</div>
                  <div className="text-2xs text-soft mt-0.5">{formatDate(r.occurredAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function RecentCommunicationsCard() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof recordRepo.listByClass>>>([])
  const navigate = useNavigate()
  useEffect(() => {
    void (async () => {
      const cls = await classRepo.listAll()
      const cid = cls[0]?.id
      if (!cid) return setItems([])
      const arr = await recordRepo.listByClass(cid)
      setItems(arr.filter((r) => r.type === 'home').slice(0, 5))
    })()
  }, [])
  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <div className="text-sm font-semibold">家校沟通动态</div>
        <button onClick={() => navigate('/communications')} className="text-xs text-soft hover:text-ink-700">查看 →</button>
      </div>
      <div className="px-4 py-3">
        {items.length === 0 ? (
          <div className="text-xs text-soft text-center py-4">暂无家校沟通</div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <MessageSquare size={12} className="mt-0.5 text-soft" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{r.title || r.content}</div>
                  <div className="text-2xs text-soft mt-0.5">{formatDate(r.occurredAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PerformanceSnapshotCard() {
  const navigate = useNavigate()
  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <div className="text-sm font-semibold">工作流速览</div>
        <span className="text-2xs text-soft">实时</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <FlowRow icon={GraduationCap} label="班级" value="去查看班级" onClick={() => navigate('/classes')} />
        <FlowRow icon={TrendingUp} label="成绩分析" value="查看趋势" onClick={() => navigate('/grades')} />
        <FlowRow icon={AlertTriangle} label="回收站" value="恢复误删" onClick={() => navigate('/trash')} />
      </div>
    </div>
  )
}

function FlowRow({ icon: Icon, label, value, onClick }: { icon: import("lucide-react").LucideIcon; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between text-xs hover:bg-ink-50 -mx-2 px-2 py-1 rounded">
      <span className="flex items-center gap-2"><Icon size={12} className="text-soft" />{label}</span>
      <span className="text-soft">{value}</span>
    </button>
  )
}
