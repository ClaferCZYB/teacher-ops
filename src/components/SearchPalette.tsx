/**
 * 全局搜索面板（Cmd/Ctrl + K）
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useNavigate } from 'react-router-dom'
import { Search, X, User, GraduationCap, BookOpen, MessageSquare, ListTodo, ClipboardList } from 'lucide-react'
import {
  studentRepo, classRepo, taskRepo, recordRepo, communicationRepo, gradeRepo, examRepo,
} from '@/db/repositories'
import type { Student, ClassEntity, Task, StudentRecord, Communication, Grade, Exam } from '@/types/models'
import { RECORD_TYPE_LABEL } from '@/types/models'
import { cn, formatDate } from '@/utils/helpers'

type Hit =
  | { kind: 'student'; item: Student; score: number }
  | { kind: 'class'; item: ClassEntity; score: number }
  | { kind: 'task'; item: Task; score: number }
  | { kind: 'record'; item: StudentRecord; score: number }
  | { kind: 'communication'; item: Communication; score: number }
  | { kind: 'grade'; item: Grade; item2: Exam; score: number }

const ICON: Record<Hit['kind'], import("lucide-react").LucideIcon> = {
  student: User,
  class: GraduationCap,
  task: ListTodo,
  record: BookOpen,
  communication: MessageSquare,
  grade: ClipboardList,
}

const KIND_LABEL: Record<Hit['kind'], string> = {
  student: '学生',
  class: '班级',
  task: '待办',
  record: '成长记录',
  communication: '家校沟通',
  grade: '成绩',
}

function fuzzyScore(q: string, target: string): number {
  if (!q) return 0
  const t = target.toLowerCase()
  if (t.startsWith(q)) return 100
  if (t.includes(q)) return 50
  // 字顺序匹配
  let qi = 0
  for (const ch of t) {
    if (qi < q.length && ch === q[qi]) qi++
  }
  if (qi === q.length) return 20
  return 0
}

export function SearchPalette() {
  const open = useUIStore((s) => s.searchOpen)
  const close = useUIStore((s) => s.closeSearch)
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(0)

  // 全局快捷键：Cmd/Ctrl + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) close()
        else useUIStore.getState().openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30)
      setQ('')
      setHits([])
      setActive(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const term = q.trim()
    if (!term) {
      setHits([])
      return
    }
    setLoading(true)
    void (async () => {
      const [stds, cls, tks, recs, coms, grs, exs] = await Promise.all([
        studentRepo.listAll(),
        classRepo.listAll(),
        taskRepo.listAll(),
        recordRepo.listAll(),
        communicationRepo.listAll(),
        gradeRepo.listAll(),
        examRepo.listAll(),
      ])
      if (cancelled) return
      const found: Hit[] = []
      const examMap = new Map(exs.map((e) => [e.id, e]))
      stds.forEach((s) => {
        const sc = Math.max(fuzzyScore(term, s.name), fuzzyScore(term, s.studentNo))
        if (sc > 0) found.push({ kind: 'student', item: s, score: sc })
      })
      cls.forEach((c) => {
        const sc = fuzzyScore(term, c.name)
        if (sc > 0) found.push({ kind: 'class', item: c, score: sc })
      })
      tks.forEach((t) => {
        const sc = Math.max(fuzzyScore(term, t.title), fuzzyScore(term, t.content ?? ''))
        if (sc > 0) found.push({ kind: 'task', item: t, score: sc })
      })
      recs.forEach((r) => {
        const sc = Math.max(fuzzyScore(term, r.content), fuzzyScore(term, r.title ?? ''))
        if (sc > 0) found.push({ kind: 'record', item: r, score: sc })
      })
      coms.forEach((c) => {
        const sc = Math.max(fuzzyScore(term, c.subject), fuzzyScore(term, c.parentName))
        if (sc > 0) found.push({ kind: 'communication', item: c, score: sc })
      })
      grs.forEach((g) => {
        const exam = examMap.get(g.examId)
        const sc = fuzzyScore(term, exam?.name ?? '')
        if (sc > 0) found.push({ kind: 'grade', item: g, item2: exam!, score: sc })
      })
      if (cancelled) return
      found.sort((a, b) => b.score - a.score)
      setHits(found.slice(0, 30))
      setActive(0)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [q, open])

  const enter = (h: Hit) => {
    close()
    switch (h.kind) {
      case 'student':
        navigate(`/students/${h.item.id}`)
        break
      case 'class':
        useUIStore.getState().setCurrentClassId(h.item.id)
        navigate('/classes')
        break
      case 'task':
        navigate('/tasks')
        break
      case 'record': {
        const studentId = h.item.studentId
        navigate(`/students/${studentId}?tab=timeline`)
        break
      }
      case 'communication': {
        navigate(`/students/${h.item.studentId}?tab=communications`)
        break
      }
      case 'grade': {
        navigate(`/grades?examId=${h.item.examId}`)
        break
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3">
      <div className="absolute inset-0 bg-ink-900/40" onClick={close} />
      <div className="relative w-full max-w-xl bg-white border border-ink-100 rounded-lg shadow-soft overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink-100">
          <Search size={16} className="text-soft" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, hits.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              }
              if (e.key === 'Enter' && hits[active]) {
                enter(hits[active])
              }
            }}
            placeholder="搜索学生、班级、成绩、记录、待办…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-400"
          />
          <kbd className="text-2xs text-soft border border-ink-200 rounded px-1.5">ESC</kbd>
          <button onClick={close} className="p-1 rounded hover:bg-ink-100 text-soft" aria-label="关闭">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {!q && (
            <div className="px-4 py-6 text-center text-sm text-soft">
              输入关键词以搜索学生、班级、待办、成长记录、家校沟通、成绩、课堂记录…
              <div className="text-2xs mt-1 text-muted-400">提示：随时按 ⌘/Ctrl + K 唤起</div>
            </div>
          )}
          {q && !loading && hits.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-soft">无匹配结果</div>
          )}
          {hits.map((h, idx) => {
            const Icon = ICON[h.kind]
            const isActive = idx === active
            return (
              <button
                key={`${h.kind}-${h.item.id}-${idx}`}
                onClick={() => enter(h)}
                onMouseEnter={() => setActive(idx)}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2.5 text-left border-b border-ink-100/60 last:border-b-0',
                  isActive && 'bg-ink-50',
                )}
              >
                <div className="w-7 h-7 shrink-0 rounded-md bg-ink-100 text-ink-700 flex items-center justify-center">
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-900 truncate">
                      {renderHitTitle(h)}
                    </span>
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-ink-100 text-soft">{KIND_LABEL[h.kind]}</span>
                  </div>
                  {renderHitDetail(h) && (
                    <div className="text-xs text-soft mt-0.5 line-clamp-1">{renderHitDetail(h)}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function renderHitTitle(h: Hit): string {
  switch (h.kind) {
    case 'student': return h.item.name
    case 'class': return h.item.name
    case 'task': return h.item.title
    case 'record': return (h.item.title || RECORD_TITLE(h.item.content)) ?? '记录'
    case 'communication': return h.item.subject
    case 'grade': return `${h.item2?.name ?? '考试'} · ${h.item.score}`
  }
}
function RECORD_TITLE(c: string) {
  return c.length > 12 ? c.slice(0, 12) + '…' : c
}

function renderHitDetail(h: Hit): string | null {
  switch (h.kind) {
    case 'student': return `${h.item.studentNo} · 班级 ${h.item.classId.slice(0, 6)}`
    case 'class': return `${h.item.grade} · ${h.item.term} · ${h.item.isHomeroom ? '班主任' : '任课'}`
    case 'task': return `${h.item.priority === 'high' ? '高优' : h.item.priority === 'medium' ? '中' : '低'} · ${h.item.dueDate ?? '无截止'}`
    case 'record': return `${RECORD_TYPE_LABEL[h.item.type]} · ${formatDate(h.item.occurredAt)}`
    case 'communication': return `${h.item.parentName} · ${formatDate(h.item.occurredAt)}`
    case 'grade': return `分数 ${h.item.score} · 考试日 ${formatDate(h.item2?.examDate)}`
  }
}
