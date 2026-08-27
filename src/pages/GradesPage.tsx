/**
 * 成绩管理 — 多班级、多考试、多科目录入 / Excel 导入 / 分析
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { classRepo, examRepo, gradeRepo, studentRepo } from '@/db/repositories'
import type { ClassEntity, Exam, Grade, Student } from '@/types/models'
import { EXAM_SUBJECTS } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { toast } from '@/store/toast'
import * as XLSX from 'xlsx'
import { downloadBlob } from '@/utils/helpers'
import { Plus, Edit3, Trash2, Upload, Download, ChartBar, X, Check } from 'lucide-react'

export function GradesPage() {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [sp] = useSearchParams()
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [cid, setCid] = useState<string>(currentClassId ?? '')
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string>(sp.get('examId') ?? '')
  const [grades, setGrades] = useState<Grade[]>([])
  const [examForm, setExamForm] = useState<{ open: boolean; initial: Exam | null }>({ open: false, initial: null })
  const [addSubjectOpen, setAddSubjectOpen] = useState(false)
  const [customSubject, setCustomSubject] = useState('')

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!cid && cls.length) setCid(cls[0].id)
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!cid) { setExams([]); setStudents([]); setGrades([]); return }
      const [exs, stds] = await Promise.all([examRepo.listByClass(cid), studentRepo.listByClass(cid)])
      setExams(exs); setStudents(stds)
      if (!selectedExamId && exs.length) setSelectedExamId(exs[0].id)
    })()
  }, [cid])

  useEffect(() => {
    void (async () => {
      if (!selectedExamId) return setGrades([])
      setGrades(await gradeRepo.listByExam(selectedExamId))
    })()
  }, [selectedExamId])

  const selectedExam = exams.find((e) => e.id === selectedExamId)
  const subjects: string[] = selectedExam?.subjects?.length
    ? selectedExam.subjects
    : selectedExam?.subject
      ? [selectedExam.subject]
      : []

  const gradeMap = useMemo(() => {
    const m = new Map<string, Grade>()
    for (const g of grades) m.set(`${g.studentId}|${g.subject}`, g)
    return m
  }, [grades])

  function reloadGrades() { if (selectedExamId) gradeRepo.listByExam(selectedExamId).then(setGrades) }

  /** 计算并持久化「各科班排名」（总分班排名在前端展示）。 */
  async function recomputeRanks(examId: string, subs: string[]) {
    const all = await gradeRepo.listByExam(examId)
    for (const sub of subs) {
      const list = all
        .filter((g) => g.subject === sub && g.score != null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      for (let i = 0; i < list.length; i++) {
        if (list[i].rank !== i + 1) await gradeRepo.update(list[i].id, { rank: i + 1 })
      }
    }
  }

  async function deleteExam(e: Exam) {
    if (!confirm(`删除"${e.name}"？所有相关学生成绩也会被删除。`)) return
    const gs = await gradeRepo.listByExam(e.id)
    for (const g of gs) await gradeRepo.hardDelete(g.id)
    await examRepo.softDelete(e.id)
    const next = await examRepo.listByClass(cid)
    setExams(next)
    if (selectedExamId === e.id) setSelectedExamId(next[0]?.id ?? '')
    toast.success('已删除')
  }

  async function addSubject(sub: string) {
    const name = sub.trim()
    if (!selectedExam || !name || subjects.includes(name)) { setAddSubjectOpen(false); return }
    const next = [...subjects, name]
    await examRepo.update(selectedExam.id, { subjects: next })
    setExams((exs) => exs.map((x) => (x.id === selectedExam.id ? { ...x, subjects: next } : x)))
    setAddSubjectOpen(false); setCustomSubject('')
    toast.success(`已添加科目「${name}」`)
  }

  async function removeSubject(sub: string) {
    if (!selectedExam) return
    if (!confirm(`移除科目「${sub}」？该科已录入的成绩也会删除。`)) return
    const next = subjects.filter((s) => s !== sub)
    await examRepo.update(selectedExam.id, { subjects: next })
    const toDelete = grades.filter((g) => g.subject === sub)
    for (const g of toDelete) await gradeRepo.hardDelete(g.id)
    setExams((exs) => exs.map((x) => (x.id === selectedExam.id ? { ...x, subjects: next } : x)))
    reloadGrades()
    toast.success('已移除')
  }

  async function importGradesExcel() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file || !selectedExam) return
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
        let count = 0, unmatched = 0
        for (const r of rows) {
          const no = String(r['学号'] ?? r['studentNo'] ?? '').trim()
          if (!no) continue
          const student = students.find((s) => s.studentNo === no || s.name === no)
          if (!student) { unmatched++; continue }
          // 校排名（若 Excel 提供）
          const srRaw = r['校排名'] ?? r['schoolRank'] ?? r['校名排名'] ?? ''
          const schoolRank = srRaw !== '' && srRaw != null ? Number(srRaw) : null
          const sr = schoolRank != null && !isNaN(schoolRank) ? schoolRank : null
          for (const sub of subjects) {
            const raw = r[sub] ?? r[sub.trim()]
            if (raw === '' || raw == null) continue
            const score = Number(raw)
            if (isNaN(score)) continue
            await gradeRepo.upsertForStudent({
              examId: selectedExam.id,
              studentId: student.id,
              classId:  cid,
              subject: sub,
              score,
              schoolRank: sr,
              fullScore: selectedExam.fullScores?.[sub],
            })
            count++
          }
        }
        await recomputeRanks(selectedExam.id, subjects)
        reloadGrades()
        toast.success(`已导入 ${count} 条成绩`, unmatched ? `无法匹配 ${unmatched} 条学生` : undefined)
      } catch (err) {
        toast.error('导入失败', String((err as Error)?.message ?? err))
      }
    }
    input.click()
  }

  function exportGradesExcel() {
    if (!selectedExam) return
    const rows = students.map((s) => {
      const row: Record<string, any> = { 学号: s.studentNo, 姓名: s.name }
      let total = 0
      let has = false
      for (const sub of subjects) {
        const g = gradeMap.get(`${s.id}|${sub}`)
        const sc = g?.score
        row[sub] = sc ?? ''
        if (sc != null) { total += sc; has = true }
      }
      row['总分'] = has ? total : ''
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '成绩')
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    downloadBlob(`${selectedExam.name}-成绩.xlsx`, new Blob([out], { type: 'application/octet-stream' }))
    toast.success('已导出')
  }

  return (
    <div>
      <PageHeader
        title="成绩"
        description="按考试查看与分析学生成绩（支持多科目）"
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={cid} onChange={(e) => { setCid(e.target.value); setSelectedExamId('') }}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button onClick={() => setExamForm({ open: true, initial: null })} disabled={!cid}><Plus size={14} /> 新建考试</Button>
          </>
        }
      />

      <div className="card p-3 mb-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {exams.length === 0 ? <div className="text-xs text-soft">该班级还没有考试</div> : (
          <>
            <select className="input py-1.5 w-auto pr-8" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}（{formatSimple(e.examDate)}）</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={importGradesExcel}><Upload size={14} /> Excel 导入</Button>
            <Button variant="outline" size="sm" onClick={exportGradesExcel}><Download size={14} /> 导出</Button>
            <Button variant="ghost" size="sm" onClick={() => selectedExam && setExamForm({ open: true, initial: selectedExam })}><Edit3 size={14} /> 编辑</Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => selectedExam && deleteExam(selectedExam)}><Trash2 size={14} /></Button>
          </>
        )}
      </div>

      {selectedExam && (
        <div className="card p-3 mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-soft">本次考试科目：</span>
          {subjects.map((sub) => (
            <span key={sub} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper-100 text-xs">
              {sub}
              <button className="text-soft hover:text-red-600" onClick={() => removeSubject(sub)} aria-label="移除科目"><X size={12} /></button>
            </span>
          ))}
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setAddSubjectOpen((v) => !v)}><Plus size={12} /> 添加科目</Button>
            {addSubjectOpen && (
              <div className="absolute z-20 mt-1 w-60 card p-2 shadow-lg">
                <div className="flex flex-wrap gap-1 mb-2">
                  {EXAM_SUBJECTS.filter((s) => !subjects.includes(s)).map((s) => (
                    <button key={s} className="px-2 py-1 rounded bg-paper-100 hover:bg-paper-200 text-xs" onClick={() => addSubject(s)}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input className="input py-1 flex-1" placeholder="自定义科目" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSubject(customSubject) }} />
                  <Button size="sm" onClick={() => addSubject(customSubject)}><Check size={12} /></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedExam && subjects.length > 0 && (
        <AnalysisPanel students={students} subjects={subjects} gradeMap={gradeMap} exam={selectedExam} />
      )}

      {!cid ? <Empty title="请选择班级" />
        : students.length === 0 ? <Empty title="班级还没有学生" />
        : !selectedExamId ? <Empty title="还没有考试" description="点击右上角'新建考试'开始。" />
        : subjects.length === 0 ? <Empty title="请先添加科目" description="点击上方'添加科目'选择本次考试的科目。" />
        : <GradeTable students={students} subjects={subjects} gradeMap={gradeMap} exam={selectedExam!} onSaved={async () => { await recomputeRanks(selectedExam!.id, subjects); reloadGrades() }} />}

      {examForm.open && (
        <ExamFormModal
          open
          editing={examForm.initial}
          classId={cid}
          onClose={() => setExamForm({ open: false, initial: null })}
          onSaved={async () => {
            setExamForm({ open: false, initial: null })
            const exs = await examRepo.listByClass(cid)
            setExams(exs)
            if (!selectedExamId && exs.length) setSelectedExamId(exs[0].id)
          }}
        />
      )}
    </div>
  )
}

function formatSimple(d: string) { return d ? new Date(d).toLocaleDateString() : '' }

/* ---------------- 录入表格 ---------------- */
interface GradeTableProps {
  students: Student[]
  subjects: string[]
  gradeMap: Map<string, Grade>
  exam: Exam
  onSaved: () => void | Promise<void>
}

function GradeTable({ students, subjects, gradeMap, exam, onSaved }: GradeTableProps) {
  const [editKey, setEditKey] = useState<string | null>(null)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  const totals = students.map((s) => {
    let total = 0; let has = false
    for (const sub of subjects) {
      const g = gradeMap.get(`${s.id}|${sub}`)
      if (g?.score != null) { total += g.score; has = true }
    }
    return { s, total, has }
  })
  const ranked = totals.filter((t) => t.has).sort((a, b) => b.total - a.total)
  const rankMap = new Map(ranked.map((t, i) => [t.s.id, i + 1]))
  const hasSchoolRank = Array.from(gradeMap.values()).some((g) => g.schoolRank != null)

  function startEdit(s: Student, sub: string) {
    const g = gradeMap.get(`${s.id}|${sub}`)
    setEditKey(`${s.id}|${sub}`)
    setVal(g?.score != null ? String(g.score) : '')
  }

  async function save(s: Student, sub: string) {
    const score = Number(val)
    setSaving(true)
    try {
      await gradeRepo.upsertForStudent({
        examId: exam.id,
        studentId: s.id,
        classId: s.classId,
        subject: sub,
        score: isNaN(score) ? 0 : score,
        fullScore: exam.fullScores?.[sub],
      })
      setEditKey(null)
      await onSaved()
      toast.success(`已保存 ${s.name} · ${sub}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>学号</th>
              <th>姓名</th>
              {subjects.map((sub) => <th key={sub} className="text-center">{sub}<div className="text-2xs font-normal text-soft">班排名</div></th>)}
              <th className="text-center">总分</th>
              <th className="text-center">总排名</th>
              {hasSchoolRank && <th className="text-center">校排名</th>}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const t = totals.find((x) => x.s.id === s.id)!
              let sSchoolRank: number | null = null
              for (const sub of subjects) {
                const g = gradeMap.get(`${s.id}|${sub}`)
                if (g?.schoolRank != null) { sSchoolRank = g.schoolRank; break }
              }
              return (
                <tr key={s.id}>
                  <td className="font-mono text-soft">{s.studentNo}</td>
                  <td className="whitespace-nowrap">{s.name}</td>
                  {subjects.map((sub) => {
                    const g = gradeMap.get(`${s.id}|${sub}`)
                    const key = `${s.id}|${sub}`
                    const st = exam.fullScores?.[sub] ?? exam.fullScore
                    return (
                      <td key={sub} className="text-center">
                        {editKey === key ? (
                          <input
                            autoFocus
                            className="input py-1 w-16 text-center"
                            value={val}
                            disabled={saving}
                            onChange={(e) => setVal(e.target.value)}
                            onBlur={() => save(s, sub)}
                            onKeyDown={(e) => { if (e.key === 'Enter') save(s, sub); if (e.key === 'Escape') setEditKey(null) }}
                          />
                        ) : (
                          <button
                            className="inline-block min-w-[2.5rem] px-1 py-0.5 rounded hover:bg-paper-100 text-center leading-tight"
                            onClick={() => startEdit(s, sub)}
                            title={st ? `满分 ${st}` : '点击录入'}
                          >
                            {g?.score != null ? (
                              <div>
                                <span className={scoreTone(g.score, st)}>{g.score}</span>
                                {g.rank != null && <span className="block text-2xs text-soft">班{g.rank}</span>}
                              </div>
                            ) : <span className="text-soft">—</span>}
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-center font-semibold">{t.has ? t.total : '—'}</td>
                  <td className="text-center text-soft">{rankMap.get(s.id) ?? '—'}</td>
                  {hasSchoolRank && <td className="text-center text-soft">{sSchoolRank ?? '—'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function scoreTone(score: number, full?: number): string {
  if (full == null) return 'text-ink-900'
  const r = score / full
  if (r >= 0.85) return 'text-emerald-700'
  if (r >= 0.6) return 'text-ink-900'
  if (r >= 0.4) return 'text-amber-700'
  return 'text-red-600'
}

/* ---------------- 分析面板 ---------------- */
function AnalysisPanel({ students, subjects, gradeMap, exam }: {
  students: Student[]; subjects: string[]; gradeMap: Map<string, Grade>; exam: Exam
}) {
  function statFor(sub?: string) {
    const scores: number[] = []
    for (const s of students) {
      const g = sub ? gradeMap.get(`${s.id}|${sub}`) : null
      if (sub) { if (g?.score != null) scores.push(g.score) }
    }
    if (!sub) {
      // total
      for (const s of students) {
        let total = 0; let has = false
        for (const sb of subjects) { const gg = gradeMap.get(`${s.id}|${sb}`); if (gg?.score != null) { total += gg.score; has = true } }
        if (has) scores.push(total)
      }
    }
    if (!scores.length) return null
    const max = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const full = sub ? (exam.fullScores?.[sub] ?? exam.fullScore) : undefined
    const passLine = full ? full * 0.6 : undefined
    const passRate = passLine ? scores.filter((x) => x >= passLine!).length / scores.length : undefined
    return { max, min, avg, passRate }
  }

  const totalStat = statFor(undefined)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
      {subjects.map((sub) => {
        const st = statFor(sub)
        return (
          <div key={sub} className="card px-3 py-2">
            <div className="text-2xs text-soft mb-1">{sub}（{exam.fullScores?.[sub] ?? exam.fullScore ?? '—'}分制）</div>
            {st ? (
              <div className="text-sm space-y-0.5">
                <div><span className="text-soft">平均</span> <b>{st.avg.toFixed(1)}</b></div>
                <div className="text-soft text-xs">最高 {st.max} · 最低 {st.min}{st.passRate != null ? ` · 及格率 ${(st.passRate * 100).toFixed(0)}%` : ''}</div>
              </div>
            ) : <div className="text-xs text-soft">暂无数据</div>}
          </div>
        )
      })}
      {totalStat && (
        <div className="card px-3 py-2 bg-paper-100">
          <div className="text-2xs text-soft mb-1">总分</div>
          <div className="text-sm space-y-0.5">
            <div><span className="text-soft">平均</span> <b>{totalStat.avg.toFixed(1)}</b></div>
            <div className="text-soft text-xs">最高 {totalStat.max} · 最低 {totalStat.min}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- 考试表单（含科目选择） ---------------- */
interface ExamFormProps {
  open: boolean
  editing: Exam | null
  classId: string
  onClose: () => void
  onSaved: () => void
}

function ExamFormModal({ open, editing, classId, onClose, onSaved }: ExamFormProps) {
  const [name, setName] = useState('')
  const [subjects, setSubjects] = useState<string[]>(['物理'])
  const [fullScores, setFullScores] = useState<Record<string, number>>({})
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<Exam['type']>('monthly')
  const [defaultFull, setDefaultFull] = useState('100')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setSubjects(editing.subjects?.length ? editing.subjects : (editing.subject ? [editing.subject] : ['物理']))
      setFullScores(editing.fullScores ?? {})
      setExamDate(editing.examDate)
      setType(editing.type)
      setDefaultFull(editing.fullScore ? String(editing.fullScore) : '100')
      setNote(editing.note ?? '')
    } else {
      setName(''); setSubjects(['物理']); setFullScores({}); setExamDate(new Date().toISOString().slice(0, 10))
      setType('monthly'); setDefaultFull('100'); setNote('')
    }
  }, [open, editing])

  function toggleSubject(sub: string) {
    if (subjects.includes(sub)) {
      setSubjects(subjects.filter((s) => s !== sub))
      const rest = { ...fullScores }; delete rest[sub]; setFullScores(rest)
    } else {
      setSubjects([...subjects, sub])
      setFullScores({ ...fullScores, [sub]: Number(defaultFull) || 100 })
    }
  }
  function setFull(sub: string, v: string) { setFullScores({ ...fullScores, [sub]: Number(v) || 0 }) }

  async function save() {
    if (!name.trim()) { toast.warn('请填写考试名称'); return }
    if (subjects.length === 0) { toast.warn('请至少选择一个科目'); return }
    setSaving(true)
    try {
      const data: Partial<Exam> = {
        name: name.trim(),
        subjects,
        fullScores,
        examDate,
        type,
        fullScore: Number(defaultFull) || undefined,
        note,
        classId,
        subject: subjects[0], // 兼容旧版字段
      }
      if (editing) await examRepo.update(editing.id, data)
      else await examRepo.create(data as any)
      toast.success('已保存')
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} title={editing ? '编辑考试' : '新建考试'} onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
      </>
    }>
      <div className="space-y-3">
        <div>
          <label className="lbl">考试名称 *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：高一上 期中考试" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lbl">考试日期</label>
            <input type="date" className="input" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div>
            <label className="lbl">类型</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as Exam['type'])}>
              <option value="monthly">月考</option>
              <option value="midterm">期中</option>
              <option value="final">期末</option>
              <option value="mock">模拟考</option>
              <option value="quiz">测验</option>
              <option value="custom">其他</option>
            </select>
          </div>
        </div>
        <div>
          <label className="lbl">默认满分</label>
          <input className="input w-32" value={defaultFull} onChange={(e) => setDefaultFull(e.target.value)} placeholder="100" />
          <span className="text-xs text-soft ml-2">新增科目时套用此满分，可逐科修改</span>
        </div>
        <div>
          <label className="lbl">考试科目（点击选择，可多选）</label>
          <div className="flex flex-wrap gap-1.5">
            {EXAM_SUBJECTS.map((sub) => {
              const on = subjects.includes(sub)
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleSubject(sub)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'bg-brand text-white border-brand' : 'bg-white border-ink-200 text-soft'}`}
                >{sub}</button>
              )
            })}
          </div>
          {subjects.length > 0 && (
            <div className="mt-2 space-y-1">
              {subjects.map((sub) => (
                <div key={sub} className="flex items-center gap-2 text-sm">
                  <span className="w-12">{sub}</span>
                  <input
                    className="input py-1 w-24"
                    type="number"
                    value={fullScores[sub] ?? (Number(defaultFull) || 100)}
                    onChange={(e) => setFull(sub, e.target.value)}
                    placeholder="满分"
                  />
                  <span className="text-xs text-soft">分</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="lbl">备注</label>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
