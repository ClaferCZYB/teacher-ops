/**
 * 座位表 — 拖拽排座 + 自动排座（男女生同桌 / 高个分散列）+ S 形周期轮换 + 性别身高显示开关
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { useUIStore } from '@/store/useUIStore'
import { classRepo, studentRepo } from '@/db/repositories'
import type { ClassEntity, Student } from '@/types/models'
import { toast } from '@/store/toast'
import { cn } from '@/utils/helpers'
import { Settings, Repeat, Shuffle, Save, RotateCcw, User, Eye, EyeOff } from 'lucide-react'

const DEFAULT_ROWS = 6
const DEFAULT_COLS = 8

type Seat = { r: number; c: number }

export function SeatingPage() {
  const navigate = useNavigate()
  const currentClassId = useUIStore((s) => s.currentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(currentClassId ?? '')
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [cols, setCols] = useState(DEFAULT_COLS)
  const [openSize, setOpenSize] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hover, setHover] = useState<Seat | null>(null)
  const [showGender, setShowGender] = useState(true)
  const [showHeight, setShowHeight] = useState(true)
  const [saving, setSaving] = useState(false)

  async function refresh() {
    const cls = await classRepo.listAll()
    setClasses(cls.filter((c) => c.status === 'active'))
    if (!selectedClassId && cls.length) setSelectedClassId(cls[0].id)
    const current = cls.find((c) => c.id === (selectedClassId || cls[0]?.id))
    if (current) { setRows(current.seatRows || DEFAULT_ROWS); setCols(current.seatCols || DEFAULT_COLS) }
  }

  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    void (async () => {
      if (!selectedClassId) return setStudents([])
      const list = await studentRepo.listByClass(selectedClassId)
      setStudents(list)
      const c = classes.find((x) => x.id === selectedClassId)
      if (c) { setRows(c.seatRows || DEFAULT_ROWS); setCols(c.seatCols || DEFAULT_COLS) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, classes])

  const currentClass = classes.find((c) => c.id === selectedClassId)

  const seatMap = useMemo(() => {
    const m = new Map<string, Student>()
    for (const s of students) if (s.seatRow && s.seatCol) m.set(`${s.seatRow}-${s.seatCol}`, s)
    return m
  }, [students])

  const seatedCount = students.filter((s) => s.seatRow && s.seatCol).length
  const unseated = students.filter((s) => !s.seatRow || !s.seatCol)

  function pickSeat(r: number, c: number) {
    if (draggingId) {
      const s = students.find((x) => x.id === draggingId)
      if (!s) return
      void (async () => {
        const existing = seatMap.get(`${r}-${c}`)
        const oldR = s.seatRow ?? null
        const oldC = s.seatCol ?? null
        await studentRepo.update(s.id, { seatRow: r, seatCol: c })
        if (existing && oldR && oldC) await studentRepo.update(existing.id, { seatRow: oldR, seatCol: oldC })
        setStudents(await studentRepo.listByClass(selectedClassId))
        setDraggingId(null)
      })()
    }
  }

  async function saveSize() {
    if (!currentClass) return
    await classRepo.update(currentClass.id, { seatRows: rows, seatCols: cols })
    toast.success('座位规格已保存')
    setOpenSize(false)
    setClasses((await classRepo.listAll()).filter((c) => c.status === 'active'))
  }

  /** 自动排座：随机 + 男女生同桌 + 高个分散不同列 */
  async function autoArrange() {
    if (!selectedClassId || students.length === 0) return
    setSaving(true)
    try {
      const cells: Seat[] = []
      for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) cells.push({ r, c })
      const arranged = arrangeSeats(students.slice(0, cells.length), rows, cols)
      for (const [stu, seat] of arranged) {
        await studentRepo.update(stu.id, { seatRow: seat.r, seatCol: seat.c })
      }
      setStudents(await studentRepo.listByClass(selectedClassId))
      toast.success('已随机排座（男女生同桌 / 高个分散）')
    } finally { setSaving(false) }
  }

  /** S 形周期轮换：沿蛇形路径整体前移一个座位 */
  async function rotateS() {
    if (!selectedClassId) return
    setSaving(true)
    try {
      const updates = rotateSeatsS(students, rows, cols)
      if (updates.length === 0) { toast.warn('没有可供轮换的座位'); return }
      for (const [stu, seat] of updates) await studentRepo.update(stu.id, { seatRow: seat.r, seatCol: seat.c })
      setStudents(await studentRepo.listByClass(selectedClassId))
      toast.success(`已按 S 形轮换 ${updates.length} 人`)
    } finally { setSaving(false) }
  }

  async function clearSeats() {
    if (!selectedClassId) return
    if (!confirm('清空所有座位？学生不会被删除，仅清除座位号。')) return
    for (const s of students) await studentRepo.update(s.id, { seatRow: null, seatCol: null })
    setStudents(await studentRepo.listByClass(selectedClassId))
    toast.success('已清空座位')
  }

  return (
    <div>
      <PageHeader
        title="座位表"
        description={currentClass ? `${currentClass.name} · ${rows}×${cols} · 已排 ${seatedCount}/${students.length}` : '请选择班级'}
        actions={
          <>
            <select className="input py-1.5 w-auto pr-8" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">选择班级</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button variant="outline" onClick={() => setOpenSize(true)}><Settings size={14} /> 设置行列</Button>
            <Button variant="outline" onClick={autoArrange} loading={saving}><Shuffle size={14} /> 自动排座</Button>
            <Button variant="outline" onClick={rotateS} loading={saving}><Repeat size={14} /> S 形轮换</Button>
            <Button variant="ghost" onClick={clearSeats}><RotateCcw size={14} /> 清空</Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-3 text-xs">
        <button className={cn('inline-flex items-center gap-1 px-2 py-1 rounded border', showGender ? 'bg-ink-700 text-paper-50 border-ink-700' : 'bg-white text-soft border-ink-200')} onClick={() => setShowGender((v) => !v)}>
          {showGender ? <Eye size={12} /> : <EyeOff size={12} />} 性别
        </button>
        <button className={cn('inline-flex items-center gap-1 px-2 py-1 rounded border', showHeight ? 'bg-ink-700 text-paper-50 border-ink-700' : 'bg-white text-soft border-ink-200')} onClick={() => setShowHeight((v) => !v)}>
          {showHeight ? <Eye size={12} /> : <EyeOff size={12} />} 身高
        </button>
        <span className="text-soft">提示：拖拽学生可手动调整；点击学生进详情。</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 card p-4">
          {!selectedClassId ? <Empty title="请选择班级" />
            : students.length === 0 ? <Empty title="班级还没有学生" description="先到「学生」页面添加学生。" />
              : (
                <div className="space-y-3">
                  <div className="text-center text-xs text-soft">讲台</div>
                  <div className="flex justify-center"><div className="w-2/3 h-2 rounded bg-ink-700" /></div>
                  <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {Array.from({ length: rows * cols }, (_, idx) => {
                      const r = Math.floor(idx / cols) + 1
                      const c = (idx % cols) + 1
                      const s = seatMap.get(`${r}-${c}`)
                      const isHover = hover && hover.r === r && hover.c === c
                      return (
                        <div
                          key={idx}
                          onDragOver={(e) => { e.preventDefault(); setHover({ r, c }) }}
                          onDrop={() => { pickSeat(r, c); setHover(null) }}
                          onDragLeave={() => setHover((p) => (p?.r === r && p.c === c ? null : p))}
                          className={cn(
                            'aspect-square rounded-md border text-xs flex flex-col items-center justify-center p-1 select-none transition-colors',
                            !s && 'border-dashed border-ink-200 bg-paper-50 text-muted-400',
                            s && 'border-ink-200 bg-white hover:border-ink-700 cursor-pointer',
                            isHover && draggingId && 'border-ink-700 bg-ink-50',
                          )}
                          onClick={() => s && navigate(`/students/${s.id}`)}
                        >
                          {s ? (
                            <>
                              <div
                                draggable
                                onDragStart={() => setDraggingId(s.id)}
                                onDragEnd={() => setDraggingId(null)}
                                className={cn('w-8 h-8 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing font-medium text-paper-50',
                                  showGender ? (s.gender === 'male' ? 'bg-male' : s.gender === 'female' ? 'bg-female' : 'bg-ink-700') : 'bg-ink-700')}
                              >
                                {s.name.slice(0, 1)}
                              </div>
                              <div className="text-2xs mt-1 truncate w-full text-center">{s.name}</div>
                              {showHeight && s.height != null && <div className="text-[10px] text-soft leading-none">{s.height}</div>}
                            </>
                          ) : <span className="text-2xs text-muted-300">{r},{c}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
        </div>

        <div className="card p-3">
          <h3 className="text-xs text-soft mb-2">未排座学生（{unseated.length}）</h3>
          {unseated.length === 0 ? <div className="text-xs text-soft">全部已排座</div> : (
            <ul className="space-y-1">
              {unseated.map((s) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => setDraggingId(s.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-white border border-ink-200 cursor-grab active:cursor-grabbing hover:bg-ink-50"
                >
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-2xs text-paper-50',
                    showGender ? (s.gender === 'male' ? 'bg-male' : s.gender === 'female' ? 'bg-female' : 'bg-ink-100') : 'bg-ink-100')}>
                    {s.name.slice(0, 1)}
                  </div>
                  <span className="text-sm flex-1 truncate">{s.name}</span>
                  {showHeight && s.height != null && <span className="text-2xs text-soft">{s.height}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={openSize} onClose={() => setOpenSize(false)} title="设置座位规格" size="sm">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="行数"><input type="number" min={1} max={12} className="input" value={rows} onChange={(e) => setRows(Number(e.target.value) || 1)} /></Field>
            <Field label="列数"><input type="number" min={1} max={14} className="input" value={cols} onChange={(e) => setCols(Number(e.target.value) || 1)} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenSize(false)}>取消</Button>
            <Button onClick={saveSize}><Save size={14} /> 保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ---------------- 排座算法 ---------------- */

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function genderKey(g: Student['gender']) { return g === 'male' ? 0 : g === 'female' ? 1 : 2 }

/** 目标：同一行相邻座位尽量男女生同桌 */
function improveGender(arr: Student[], cols: number) {
  const sameGenderAdj = (a: Student[]) => {
    let bad = 0
    for (let i = 0; i + 1 < a.length; i++) {
      if ((i % cols) === cols - 1) continue
      if (genderKey(a[i].gender) === genderKey(a[i + 1].gender)) bad++
    }
    return bad
  }
  for (let pass = 0; pass < 10; pass++) {
    let improved = false
    const before = sameGenderAdj(arr)
    for (let i = 0; i + 1 < arr.length; i++) {
      if ((i % cols) === cols - 1) continue
      if (genderKey(arr[i].gender) !== genderKey(arr[i + 1].gender)) continue
      for (let j = 0; j < arr.length; j++) {
        if (j === i || j === i + 1) continue
        if (genderKey(arr[j].gender) === genderKey(arr[i].gender)) continue
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
        if (sameGenderAdj(arr) < before) { improved = true; break }
        const back = arr[i]; arr[i] = arr[j]; arr[j] = back
      }
      if (improved) break
    }
    if (!improved) break
  }
}

/** 目标：高个学生尽量分散到不同列（最小化各列平均身高与全局均值的偏差） */
function improveHeight(arr: Student[], cols: number) {
  const h = (s: Student) => s.height ?? 0
  const colAvgPenalty = (a: Student[]) => {
    const allH = a.map(h)
    const mean = allH.reduce((x, y) => x + y, 0) / (allH.length || 1)
    let pen = 0
    for (let c = 0; c < cols; c++) {
      const colH: number[] = []
      for (let i = c; i < a.length; i += cols) colH.push(h(a[i]))
      if (!colH.length) continue
      const avg = colH.reduce((x, y) => x + y, 0) / colH.length
      pen += (avg - mean) ** 2
    }
    return pen
  }
  const heights = arr.map(h)
  const median = heights.length ? [...heights].sort((x, y) => x - y)[Math.floor(heights.length / 2)] : 0
  for (let pass = 0; pass < 10; pass++) {
    let improved = false
    const before = colAvgPenalty(arr)
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r + 1 < Math.ceil(arr.length / cols); r++) {
        const i1 = r * cols + c
        const i2 = (r + 1) * cols + c
        if (i1 >= arr.length || i2 >= arr.length) continue
        if (h(arr[i1]) > median && h(arr[i2]) > median) {
          for (let j = 0; j < arr.length; j++) {
            if (j % cols === c) continue
            if (h(arr[j]) < median) {
              const tmp = arr[i1]; arr[i1] = arr[j]; arr[j] = tmp
              if (colAvgPenalty(arr) < before) { improved = true; break }
              const back = arr[i1]; arr[i1] = arr[j]; arr[j] = back
            }
          }
        }
        if (improved) break
      }
      if (improved) break
    }
    if (!improved) break
  }
}

function arrangeSeats(list: Student[], rows: number, cols: number): Array<[Student, Seat]> {
  const arr = shuffle(list)
  improveHeight(arr, cols)
  improveGender(arr, cols)
  const cells: Seat[] = []
  for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) cells.push({ r, c })
  return arr.map((stu, i) => [stu, cells[i]] as [Student, Seat])
}

/** S 形蛇形路径坐标 */
function sOrderCoords(rows: number, cols: number): Seat[] {
  const coords: Seat[] = []
  for (let r = 1; r <= rows; r++) {
    const rowCols: number[] = []
    for (let c = 1; c <= cols; c++) rowCols.push(c)
    if (r % 2 === 0) rowCols.reverse()
    for (const c of rowCols) coords.push({ r, c })
  }
  return coords
}

function rotateSeatsS(students: Student[], rows: number, cols: number): Array<[Student, Seat]> {
  const seated = students.filter((s) => s.seatRow && s.seatCol)
  if (seated.length <= 1) return []
  const coords = sOrderCoords(rows, cols)
  // 仅取被占用的坐标（保持 S 顺序），对应的学生序列
  const seq: Student[] = []
  for (const { r, c } of coords) {
    const stu = seated.find((s) => s.seatRow === r && s.seatCol === c)
    if (stu) seq.push(stu)
  }
  if (seq.length <= 1) return []
  const rotated = [seq[seq.length - 1], ...seq.slice(0, -1)]
  const result: Array<[Student, Seat]> = []
  seq.forEach((stu, idx) => result.push([rotated[idx], coords.find((co) => { const s = seated.find((x) => x.seatRow === co.r && x.seatCol === co.c); return s === stu })!]!))
  return result
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-soft mb-1">{label}</div>
      {children}
    </div>
  )
}
