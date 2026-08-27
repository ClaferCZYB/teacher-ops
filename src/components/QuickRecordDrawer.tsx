/**
 * 全局快速记录抽屉
 * - 任意页面可调用 openQuickRecord() 打开
 * - 流程：选择学生 → 选择类型 → 输入内容 → 保存
 * - 支持连续录入（保存后清空内容，不关闭抽屉）
 */
import { useEffect, useState, useMemo } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { classRepo, studentRepo, recordRepo } from '@/db/repositories'
import type { RecordType, Student, ClassEntity } from '@/types/models'
import { RECORD_TYPE_LABEL } from '@/types/models'
import { Search, Plus, X, RotateCcw, Zap, BookOpen, MessageSquare, Award, Heart, AlertCircle } from 'lucide-react'
import { cn, formatDate, nowIso } from '@/utils/helpers'
import { toast } from '@/store/toast'

const TYPE_ICON: Record<RecordType, import("lucide-react").LucideIcon> = {
  observation: BookOpen,
  study: BookOpen,
  behavior: Zap,
  talk: MessageSquare,
  home: MessageSquare,
  attendance: AlertCircle,
  reward: Award,
  demerit: AlertCircle,
  growth: Heart,
  award: Award,
  punish: AlertCircle,
  other: BookOpen,
}

const TYPE_TONE: Record<RecordType, string> = {
  observation: 'text-ink-700 bg-ink-50',
  study: 'text-sky-700 bg-sky-50',
  behavior: 'text-amber-700 bg-amber-50',
  talk: 'text-ink-700 bg-ink-50',
  home: 'text-ink-700 bg-ink-100',
  attendance: 'text-amber-700 bg-amber-50',
  reward: 'text-ink-700 bg-ink-50',
  demerit: 'text-red-700 bg-red-50',
  growth: 'text-ink-700 bg-ink-50',
  award: 'text-ink-700 bg-ink-50',
  punish: 'text-red-700 bg-red-50',
  other: 'text-soft bg-muted-100',
}

export function QuickRecordDrawer() {
  const open = useUIStore((s) => s.quickRecordOpen)
  const close = useUIStore((s) => s.closeQuickRecord)
  const currentClassId = useUIStore((s) => s.currentClassId)
  const setClass = useUIStore((s) => s.setCurrentClassId)

  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [studentQ, setStudentQ] = useState('')
  const [pickedStudent, setPickedStudent] = useState<Student | null>(null)
  const [type, setType] = useState<RecordType>('observation')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [score, setScore] = useState<string>('')

  const filteredStudents = useMemo(() => {
    const k = studentQ.trim().toLowerCase()
    if (!k) return students.slice(0, 50)
    return students
      .filter((s) => s.name.toLowerCase().includes(k) || s.studentNo.toLowerCase().includes(k))
      .slice(0, 50)
  }, [students, studentQ])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const cls = await classRepo.listAll()
      if (cancelled) return
      setClasses(cls)
      let cid = currentClassId
      if (!cid && cls.length) cid = cls[0].id
      if (cid && cid !== currentClassId) setClass(cid)
      const stds = cid ? await studentRepo.listByClass(cid) : []
      if (cancelled) return
      setStudents(stds)
    })()
    return () => {
      cancelled = true
    }
  }, [open, currentClassId, setClass])

  useEffect(() => {
    if (!open || !currentClassId) return
    void (async () => {
      const stds = await studentRepo.listByClass(currentClassId)
      setStudents(stds)
    })()
  }, [open, currentClassId])

  async function save(): Promise<void> {
    if (!pickedStudent) {
      toast.warn('请先选择学生')
      return
    }
    if (!content.trim()) {
      toast.warn('请填写记录内容')
      return
    }
    setSaving(true)
    try {
      await recordRepo.create({
        studentId: pickedStudent.id,
        classId: pickedStudent.classId,
        type,
        occurredAt: nowIso(),
        content: content.trim(),
        tags: [],
        score: score ? Number(score) : undefined,
      })
      toast.success('已保存记录', `学生：${pickedStudent.name}`)
      // 连续录入：保留学生与类型，仅清空内容与分数
      setContent('')
      setScore('')
    } catch (e) {
      console.error(e)
      toast.error('保存失败', String((e as Error)?.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const Icon = TYPE_ICON[type]

  return (
    <>
      <div className="drawer-backdrop" onClick={close} />
      <aside className="drawer open" aria-label="快速记录">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-ink-700 text-paper-50 flex items-center justify-center">
              <Zap size={14} />
            </div>
            <div>
              <div className="text-sm font-semibold">快速记录</div>
              <div className="text-xs text-soft">{formatDate(new Date(), true)}</div>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded text-muted-500 hover:bg-ink-100" aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 班级切换 */}
          <div>
            <div className="text-xs text-soft mb-1.5">当前班级</div>
            <div className="flex flex-wrap gap-1.5">
              {classes.length === 0 && (
                <span className="text-xs text-soft">尚未创建班级，请到"班级"页新建</span>
              )}
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setClass(c.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs border transition-colors',
                    currentClassId === c.id
                      ? 'bg-ink-700 text-paper-50 border-ink-700'
                      : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50',
                  )}
                >
                  {c.name}
                  {c.isHomeroom && <span className="ml-1 text-[10px] text-amber-300">·班主任</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 选择学生 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs text-soft">学生</div>
              {pickedStudent && (
                <button
                  type="button"
                  onClick={() => setPickedStudent(null)}
                  className="text-xs text-soft hover:text-ink-700"
                >
                  重选
                </button>
              )}
            </div>
            {pickedStudent ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-ink-200 bg-ink-50/40">
                <div className="w-8 h-8 rounded-full bg-ink-200 text-ink-800 flex items-center justify-center text-xs font-medium">
                  {pickedStudent.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900">{pickedStudent.name}</div>
                  <div className="text-xs text-soft">{pickedStudent.studentNo}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-400" />
                  <input
                    value={studentQ}
                    onChange={(e) => setStudentQ(e.target.value)}
                    placeholder="搜索学生姓名 / 学号"
                    className="input pl-8"
                  />
                </div>
                <div className="mt-2 max-h-[160px] overflow-y-auto rounded border border-ink-100 divide-y divide-ink-100">
                  {filteredStudents.length === 0 && (
                    <div className="px-3 py-3 text-xs text-soft text-center">无匹配学生</div>
                  )}
                  {filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setPickedStudent(s)}
                      className="w-full text-left px-3 py-2 hover:bg-ink-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm text-ink-900">{s.name}</div>
                        <div className="text-2xs text-soft">{s.studentNo}</div>
                      </div>
                      <Plus size={14} className="text-soft" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 类型 */}
          <div>
            <div className="text-xs text-soft mb-1.5">记录类型</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(RECORD_TYPE_LABEL) as Array<[RecordType, string]>).map(([k, label]) => {
                const TIcon = TYPE_ICON[k]
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setType(k)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs',
                      type === k
                        ? 'border-ink-700 bg-ink-50 text-ink-900'
                        : 'border-ink-200 bg-white text-soft hover:bg-ink-50',
                    )}
                  >
                    <TIcon size={12} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 内容 */}
          <div>
            <div className="text-xs text-soft mb-1.5 flex items-center gap-1.5">
              <Icon size={12} className={cn('p-1 rounded', TYPE_TONE[type])} />
              记录内容
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="简单记一笔…"
              className="input resize-none"
            />
          </div>

          {/* 加减分 */}
          {(type === 'reward' || type === 'punish' || type === 'award' || type === 'demerit') && (
            <div>
              <div className="text-xs text-soft mb-1.5">分值</div>
              <input
                inputMode="decimal"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="如 +5 或 -2"
                className="input"
              />
            </div>
          )}

          <div className="text-xs text-soft">
            保存后可继续录入下一条，本页不会跳转。
          </div>
        </div>

        {/* footer */}
        <div className="border-t border-ink-100 px-4 py-3 flex justify-between items-center gap-2 safe-bottom">
          <button
            type="button"
            onClick={() => {
              setContent('')
              setScore('')
            }}
            className="btn-ghost"
          >
            <RotateCcw size={14} /> 清空
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="btn-primary"
          >
            {saving ? '保存中…' : '保存并继续'}
          </button>
        </div>
      </aside>
    </>
  )
}
