/**
 * 考勤 — 按日批量记录 + 统计
 */
import { useEffect, useMemo, useState, useRef } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { classRepo, studentRepo, attendanceRepo } from '@/db/repositories'
import { syncAttendance, clearAttendanceRecord } from '@/db/syncTimeline'
import type { ClassEntity, Student, Attendance, AttendanceStatus } from '@/types/models'
import { ATTENDANCE_STATUS_LABEL } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import { formatDate, cn } from '@/utils/helpers'
import {
  ClipboardCheck, ChevronLeft, ChevronRight, Save, Filter, ListChecks,
} from 'lucide-react'

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: 'status-good',
  late: 'status-warn',
  early: 'status-warn',
  leave: 'status-info',
  absent: 'status-bad',
  other: 'status-neutral',
}

export function AttendancePage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [date, setDate] = useState<string>(formatDate(new Date()))
  const [records, setRecords] = useState<Attendance[]>([])
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all')
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const cls = await classRepo.listAll()
      setClasses(cls.filter((c) => c.status === 'active'))
      if (!cid && cls.length) setCid(cls[0].id)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) return setStudents([])
      const list = await studentRepo.listByClass(cid)
      setStudents(list)
    })()
  }, [cid])

  useEffect(() => {
    void (async () => {
      if (!cid) return setRecords([])
      const list = await attendanceRepo.listByClass(cid, date, date)
      setRecords(list)
    })()
  }, [cid, date])

  const presentMap = useMemo(() => {
    const m = new Map<string, Attendance>()
    for (const r of records) m.set(r.studentId, r)
    return m
  }, [records])

  const tally = useMemo(() => {
    const t: Record<string, number> = { present: 0, absent: 0, late: 0, early: 0, leave: 0, other: 0 }
    for (const r of records) t[r.status] = (t[r.status] ?? 0) + 1
    return t
  }, [records])

  function shiftDate(days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(formatDate(d))
  }

  async function setStatus(s: Student, status: AttendanceStatus) {
    try {
      const updated = await attendanceRepo.upsertForStudent({
        studentId: s.id, classId: cid, date, status,
      })
      await syncAttendance(updated)
      setRecords((arr) => {
        const i = arr.findIndex((x) => x.studentId === s.id)
        if (i >= 0) {
          const next = arr.slice(); next[i] = updated; return next
        }
        return [...arr, updated]
      })
    } catch (e) {
      toast.error('保存失败', String((e as Error)?.message ?? e))
    }
  }

  async function markAllPresent() {
    setSaving(true)
    try {
      for (const s of students) {
        const updated = await attendanceRepo.upsertForStudent({ studentId: s.id, classId: cid, date, status: 'present' })
        await syncAttendance(updated) // 出勤 → 清除可能存在的异常记录
      }
      const next = await attendanceRepo.listByClass(cid, date, date)
      setRecords(next)
      toast.success('已标记全员出勤')
    } finally {
      setSaving(false)
    }
  }

  async function clearDay() {
    if (!confirm(`清空 ${date} 的所有考勤？`)) return
    for (const r of records) {
      await attendanceRepo.softDelete(r.id)
      await clearAttendanceRecord(r.id)
    }
    setRecords([])
    toast.success('已清空')
  }

  const visibleStudents = useMemo(() => {
    if (statusFilter === 'all') return students
    return students.filter((s) => presentMap.get(s.id)?.status === statusFilter)
  }, [students, statusFilter, presentMap])

  return (
    <div>
      <PageHeader
        title="考勤"
        description="按日批量记录学生出勤情况"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        }
      />

      {/* 日期切换 */}
      <div className="card p-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 bg-paper-100 rounded-md p-1">
            <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)} className="gap-1">
              <ChevronLeft size={14} /> 上一天
            </Button>
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.()}
              className="px-3 py-1 text-sm font-medium whitespace-nowrap hover:text-ink-700 rounded"
              title="点击选择日期"
            >
              {date}
            </button>
            <Button variant="ghost" size="sm" onClick={() => shiftDate(1)} className="gap-1">
              下一天 <ChevronRight size={14} />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDate(formatDate(new Date()))}>回到今天</Button>

          <span className="ml-auto" />

          <Button variant="outline" size="sm" onClick={markAllPresent} loading={saving}><ListChecks size={14} /> 全员出勤</Button>
          <Button variant="ghost" size="sm" onClick={clearDay} className="text-red-600">清空</Button>
        </div>
        <input
          ref={dateInputRef}
          type="date"
          className="hidden"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* 统计 */}
      <div className="card p-3 mb-3">
        <div className="text-xs text-soft mb-2">当日统计</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(tally) as Array<keyof typeof tally>).map((k) => (
            <Tag key={k} className={STATUS_COLOR[k as AttendanceStatus]}>
              {ATTENDANCE_STATUS_LABEL[k as AttendanceStatus]} · {tally[k]}
            </Tag>
          ))}
        </div>
      </div>

      {/* 筛选 */}
      <div className="card p-3 mb-3 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        <Filter size={12} className="text-soft" />
        {([
          ['all', '全部'],
          ...Object.entries(ATTENDANCE_STATUS_LABEL).map(([k, v]) => [k, v]),
        ] as Array<[AttendanceStatus | 'all', string]>).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(k as any)}
            className={cn('px-2 py-1 rounded text-xs border whitespace-nowrap',
              statusFilter === k ? 'bg-ink-700 text-paper-50 border-ink-700' : 'bg-white text-soft border-ink-200 hover:bg-ink-50')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 学生列表 */}
      {!cid ? <Empty title="请选择班级" />
        : students.length === 0 ? <Empty icon={<ClipboardCheck size={18} />} title="班级还没有学生" />
        : (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-ink-100">
              {visibleStudents.map((s) => {
                const r = presentMap.get(s.id)
                return (
                  <li key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900">{s.name}</div>
                      <div className="text-2xs text-soft font-mono">{s.studentNo}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(Object.entries(ATTENDANCE_STATUS_LABEL) as Array<[AttendanceStatus, string]>).map(([k, label]) => {
                        const active = r?.status === k
                        return (
                          <button
                            key={k}
                            onClick={() => setStatus(s, k)}
                            className={cn(
                              'px-2 py-1 rounded text-xs border',
                              active ? `${STATUS_COLOR[k]} border-current` : 'bg-white text-soft border-ink-200 hover:bg-ink-50',
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
    </div>
  )
}
