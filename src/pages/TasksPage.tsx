/**
 * 待办 — 个人工作管理
 * 设计借鉴：TickTick / 微软 To-Do
 *  - 智能快速录入（#标签 !优先级 今天/明天/周X/8-30）
 *  - 「我的一天」规划视图
 *  - 即将到来（按日期分组）
 *  - 子任务清单 + 进度
 *  - 标星（重要）、拖拽手动排序
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { taskRepo, classRepo } from '@/db/repositories'
import type { Task, ClassEntity, SubTask } from '@/types/models'
import { toast } from '@/store/toast'
import { uid } from '@/utils/helpers'
import {
  Plus, Check, Trash2, Calendar as CalIcon, Star, Sun,
  ChevronDown, ChevronRight, GripVertical, Pencil, Sparkles, X, ListTodo,
} from 'lucide-react'
import { cn, formatDate, diffDays } from '@/utils/helpers'

type ViewKey = 'myday' | 'open' | 'upcoming' | 'done'
type PriFilter = 'all' | 'high' | 'medium' | 'low'

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [view, setView] = useState<ViewKey>('myday')
  const [priFilter, setPriFilter] = useState<PriFilter>('all')
  const [classFilter, setClassFilter] = useState<string>('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [quick, setQuick] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [confirmDel, setConfirmDel] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  async function refresh() {
    const [tk, cls] = await Promise.all([taskRepo.listAll(), classRepo.listAll()])
    setTasks(tk)
    setClasses(cls)
  }
  useEffect(() => { void refresh() }, [])

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])

  // ---- 视图筛选 ----
  const viewTasks = useMemo(() => {
    let list = tasks
    if (view === 'myday') list = list.filter((t) => t.myDay && !t.done)
    else if (view === 'open') list = list.filter((t) => !t.done)
    else if (view === 'upcoming') list = list.filter((t) => !t.done && !!t.dueDate)
    else list = list.filter((t) => t.done)

    if (priFilter !== 'all') list = list.filter((t) => t.priority === priFilter)
    if (classFilter) list = list.filter((t) => t.classId === classFilter)
    if (starredOnly) list = list.filter((t) => t.starred)

    if (view === 'upcoming') {
      return list.slice().sort((a, b) => (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'))
    }
    if (view === 'done') {
      return list.slice().sort((a, b) => (b.doneAt || b.updatedAt).localeCompare(a.doneAt || a.updatedAt))
    }
    // 进行中 / 我的一天：手动排序优先，其次标星、优先级、日期
    return sortManual(list)
  }, [tasks, view, priFilter, classFilter, starredOnly])

  const upcomingGroups = useMemo(() => groupUpcoming(viewTasks), [viewTasks, view])

  const dragEnabled = (view === 'open' || view === 'myday')

  // ---- 操作 ----
  async function patchTask(id: string, patch: Partial<Task>) {
    await taskRepo.update(id, patch)
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  async function toggle(t: Task) {
    await patchTask(t.id, { done: !t.done, doneAt: !t.done ? new Date().toISOString() : null })
  }

  async function toggleStar(t: Task) {
    await patchTask(t.id, { starred: !t.starred })
  }

  async function toggleMyDay(t: Task) {
    await patchTask(t.id, { myDay: !t.myDay })
  }

  async function toggleSub(task: Task, subId: string) {
    const subs = (task.subtasks ?? []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s))
    await patchTask(task.id, { subtasks: subs })
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function quickAdd() {
    const text = quick.trim()
    if (!text) return
    const parsed = parseQuickAdd(text)
    const baseOrder = Math.max(0, ...tasks.filter((t) => !t.done).map((t) => t.order ?? -1)) + 1
    const data: Partial<Task> = {
      title: parsed.title || text,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      tags: parsed.tags,
      starred: parsed.starred,
      myDay: view === 'myday' ? true : undefined,
      order: dragEnabled ? baseOrder : undefined,
      done: false,
      doneAt: null,
      subtasks: [],
    }
    await taskRepo.create(data as any)
    toast.success('已添加')
    setQuick('')
    void refresh()
  }

  async function applyOrder(ordered: Task[]) {
    await Promise.all(ordered.map((t, i) => taskRepo.update(t.id, { order: i })))
    const map = new Map(ordered.map((t, i) => [t.id, i]))
    setTasks((prev) => prev.map((t) => (map.has(t.id) ? { ...t, order: map.get(t.id) } : t)))
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const ordered = viewTasks.slice()
    const from = ordered.findIndex((t) => t.id === dragId)
    const to = ordered.findIndex((t) => t.id === targetId)
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return }
    const [moved] = ordered.splice(from, 1)
    ordered.splice(to, 0, moved)
    void applyOrder(ordered)
    setDragId(null)
    setOverId(null)
  }

  async function completeAllMyDay() {
    const ids = tasks.filter((t) => t.myDay && !t.done).map((t) => t.id)
    if (!ids.length) return
    await Promise.all(ids.map((id) => taskRepo.update(id, { done: true, doneAt: new Date().toISOString() })))
    toast.success(`已完成 ${ids.length} 项`)
    void refresh()
  }

  const preview = quick.trim() ? parseQuickAdd(quick) : null

  return (
    <div>
      <PageHeader
        title="待办"
        description="教师个人工作任务的统一入口"
        actions={
          <Button onClick={() => { setEditing(null); setOpenForm(true) }}>
            <Plus size={14} /> 详细新建
          </Button>
        }
      />

      {/* 智能快速录入 */}
      <div className="card p-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-ink-400 shrink-0" />
          <input
            className="input flex-1 border-transparent bg-transparent focus:bg-white focus:border-ink-200 px-2"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void quickAdd() } }}
            placeholder="添加待办，回车保存 · 例如：与家长沟通 !高 #家访 明天"
          />
          <Button size="sm" onClick={() => void quickAdd()} disabled={!quick.trim()}>添加</Button>
        </div>
        {preview && (preview.priority !== 'medium' || preview.dueDate || preview.tags.length || preview.starred) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-7 text-xs">
            <span className="text-soft">智能识别：</span>
            {preview.priority !== 'medium' && <Tag tone={preview.priority === 'high' ? 'bad' : 'warn'}>{preview.priority === 'high' ? '高优' : '中优'}</Tag>}
            {preview.starred && <Tag tone="bad"><Star size={10} className="mr-0.5" />重要</Tag>}
            {preview.dueDate && <Tag tone="info"><CalIcon size={10} className="mr-0.5" />{preview.dueDate}</Tag>}
            {preview.tags.map((tg) => <Tag key={tg}>#{tg}</Tag>)}
          </div>
        )}
      </div>

      {/* 视图切换 */}
      <div className="card mb-3 p-1 flex items-center gap-1 overflow-x-auto hide-scrollbar">
        <ViewTab active={view === 'myday'} onClick={() => setView('myday')} icon={<Sun size={14} />} label="我的一天" count={tasks.filter((t) => t.myDay && !t.done).length} />
        <ViewTab active={view === 'open'} onClick={() => setView('open')} icon={<ListTodo size={14} />} label="进行中" count={tasks.filter((t) => !t.done).length} />
        <ViewTab active={view === 'upcoming'} onClick={() => setView('upcoming')} icon={<CalIcon size={14} />} label="即将到来" count={tasks.filter((t) => !t.done && !!t.dueDate).length} />
        <ViewTab active={view === 'done'} onClick={() => setView('done')} icon={<Check size={14} />} label="已完成" count={tasks.filter((t) => t.done).length} />
      </div>

      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
        <select className="input !w-auto py-1 px-2" value={priFilter} onChange={(e) => setPriFilter(e.target.value as PriFilter)}>
          <option value="all">全部优先级</option>
          <option value="high">高优</option>
          <option value="medium">中优</option>
          <option value="low">低优</option>
        </select>
        <select className="input !w-auto py-1 px-2" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">全部班级</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setStarredOnly((v) => !v)}
          className={cn('px-2 py-1 rounded-md border flex items-center gap-1', starredOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-ink-200 text-soft hover:bg-ink-50')}
        >
          <Star size={12} /> 仅重要
        </button>
        {(priFilter !== 'all' || classFilter || starredOnly) && (
          <button onClick={() => { setPriFilter('all'); setClassFilter(''); setStarredOnly(false) }} className="px-2 py-1 text-soft hover:text-ink-900 flex items-center gap-1">
            <X size={12} /> 清除筛选
          </button>
        )}
        {view === 'myday' && tasks.some((t) => t.myDay && !t.done) && (
          <button onClick={() => void completeAllMyDay()} className="ml-auto px-2 py-1 rounded-md text-ink-700 hover:bg-ink-100 flex items-center gap-1">
            <Check size={12} /> 全部完成
          </button>
        )}
      </div>

      {/* 列表 */}
      {viewTasks.length === 0 ? (
        <Empty
          icon={view === 'done' ? <Check size={20} /> : <ListTodo size={20} />}
          title={emptyTitle(view)}
          description={emptyDesc(view)}
          action={view === 'myday' ? undefined : <Button onClick={() => { setEditing(null); setOpenForm(true) }}><Plus size={14} /> 新建待办</Button>}
        />
      ) : view === 'upcoming' ? (
        <div className="space-y-4">
          {upcomingGroups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <span className="text-xs font-semibold text-ink-700">{g.label}</span>
                <span className="text-xs text-soft">{g.items.length}</span>
                <div className="flex-1 h-px bg-ink-100" />
              </div>
              <ul className="space-y-2">
                {g.items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    classMap={classMap}
                    expanded={expanded.has(t.id)}
                    onToggle={() => void toggle(t)}
                    onStar={() => void toggleStar(t)}
                    onMyDay={() => void toggleMyDay(t)}
                    onToggleSub={(sid) => void toggleSub(t, sid)}
                    onExpand={() => toggleExpand(t.id)}
                    onEdit={() => { setEditing(t); setOpenForm(true) }}
                    onDelete={() => setConfirmDel(t)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {viewTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              classMap={classMap}
              expanded={expanded.has(t.id)}
              dragEnabled={dragEnabled}
              dragging={dragId === t.id}
              dragOver={overId === t.id}
              onDragStart={() => setDragId(t.id)}
              onDragOver={() => setOverId(t.id)}
              onDrop={() => onDrop(t.id)}
              onDragEnd={() => { setDragId(null); setOverId(null) }}
              onToggle={() => void toggle(t)}
              onStar={() => void toggleStar(t)}
              onMyDay={() => void toggleMyDay(t)}
              onToggleSub={(sid) => void toggleSub(t, sid)}
              onExpand={() => toggleExpand(t.id)}
              onEdit={() => { setEditing(t); setOpenForm(true) }}
              onDelete={() => setConfirmDel(t)}
            />
          ))}
        </ul>
      )}

      {openForm && (
        <TaskFormModal
          open
          defaultMyDay={view === 'myday'}
          onClose={() => { setOpenForm(false); setEditing(null) }}
          initial={editing}
          classes={classes}
          onSaved={() => { setOpenForm(false); setEditing(null); void refresh() }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        destructive
        title="删除待办"
        description={`"${confirmDel?.title}" 将进入回收站。`}
        confirmText="删除"
        onConfirm={async () => {
          if (!confirmDel) return
          await taskRepo.softDelete(confirmDel.id)
          toast.success('已移至回收站')
          setConfirmDel(null)
          void refresh()
        }}
      />
    </div>
  )
}

/* ============================================================
 * 子组件
 * ============================================================ */

interface CardProps {
  task: Task
  classMap: Map<string, string>
  expanded: boolean
  onToggle: () => void
  onStar: () => void
  onMyDay: () => void
  onToggleSub: (subId: string) => void
  onExpand: () => void
  onEdit: () => void
  onDelete: () => void
  dragEnabled?: boolean
  dragging?: boolean
  dragOver?: boolean
  onDragStart?: () => void
  onDragOver?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
}

function TaskCard(p: CardProps) {
  const { task: t, classMap, expanded } = p
  const subs = t.subtasks ?? []
  const doneSub = subs.filter((s) => s.done).length
  const hasSubs = subs.length > 0
  const borderByPri = t.priority === 'high' ? 'border-l-red-400' : t.priority === 'medium' ? 'border-l-amber-400' : 'border-l-slate-300'

  return (
    <li
      draggable={p.dragEnabled}
      onDragStart={p.onDragStart}
      onDragOver={(e) => { if (p.dragEnabled) { e.preventDefault(); p.onDragOver?.() } }}
      onDrop={(e) => { if (p.dragEnabled) { e.preventDefault(); p.onDrop?.() } }}
      onDragEnd={p.onDragEnd}
      className={cn(
        'card p-2.5 pl-3 border-l-4 transition-shadow',
        borderByPri,
        p.dragging && 'opacity-40',
        p.dragOver && 'ring-2 ring-ink-300',
      )}
    >
      <div className="flex items-start gap-2">
        {p.dragEnabled && <GripVertical size={15} className="mt-1 text-muted-400 cursor-grab shrink-0" />}
        <button
          type="button"
          onClick={p.onToggle}
          className={cn(
            'mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
            t.done ? 'bg-ink-700 border-ink-700 text-paper-50' : 'border-ink-300 hover:border-ink-500',
          )}
          aria-label={t.done ? '取消完成' : '标记完成'}
        >
          {t.done && <Check size={12} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-sm font-medium', t.done ? 'text-soft line-through' : 'text-ink-900')}>{t.title}</span>
            {t.starred && <Star size={13} className="text-amber-500 fill-amber-400 shrink-0" />}
          </div>
          {t.content && <p className="text-xs text-soft mt-0.5 whitespace-pre-wrap">{t.content}</p>}

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {t.dueDate && <DuePill due={t.dueDate} done={t.done} />}
            {hasSubs && (
              <button onClick={p.onExpand} className="chip status-neutral flex items-center gap-1">
                {doneSub}/{subs.length}
                {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            )}
            {(t.tags || []).map((tag) => <Tag key={tag}>#{tag}</Tag>)}
            {t.classId && <Tag tone="good">{classMap.get(t.classId) ?? '班级'}</Tag>}
            {t.myDay && <Tag tone="info"><Sun size={10} className="mr-0.5" />我的一天</Tag>}
          </div>

          {expanded && hasSubs && (
            <ul className="mt-2 space-y-1 pl-1 border-l border-ink-100 ml-1">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => p.onToggleSub(s.id)}
                    className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', s.done ? 'bg-ink-700 border-ink-700 text-paper-50' : 'border-ink-300 hover:border-ink-500')}
                    aria-label={s.done ? '取消' : '完成'}
                  >
                    {s.done && <Check size={10} />}
                  </button>
                  <span className={cn(s.done ? 'text-soft line-through' : 'text-ink-700')}>{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <IconBtn onClick={p.onMyDay} active={t.myDay} title={t.myDay ? '移出我的一天' : '加入我的一天'}>
            <Sun size={15} className={t.myDay ? 'text-amber-500 fill-amber-400' : ''} />
          </IconBtn>
          <IconBtn onClick={p.onStar} active={t.starred} title={t.starred ? '取消标星' : '标星（重要）'}>
            <Star size={15} className={t.starred ? 'text-amber-500 fill-amber-400' : ''} />
          </IconBtn>
          <IconBtn onClick={p.onEdit} title="编辑"><Pencil size={15} /></IconBtn>
          <IconBtn onClick={p.onDelete} danger title="删除"><Trash2 size={15} /></IconBtn>
        </div>
      </div>
    </li>
  )
}

function IconBtn({ children, onClick, title, active, danger }: {
  children: React.ReactNode; onClick: () => void; title: string; active?: boolean; danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
        danger ? 'text-muted-400 hover:text-red-600 hover:bg-red-50'
          : active ? 'text-amber-500 bg-amber-50'
          : 'text-muted-400 hover:text-ink-700 hover:bg-ink-100',
      )}
    >
      {children}
    </button>
  )
}

function DuePill({ due, done }: { due: string; done: boolean }) {
  const d = new Date(due)
  const diff = diffDays(new Date(), d)
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  let tone: 'bad' | 'warn' | 'info' | 'neutral' = 'neutral'
  let label = `${md} 周${wd}`
  if (!done) {
    if (diff < 0) { tone = 'bad'; label = `逾期 ${md}` }
    else if (diff === 0) { tone = 'warn'; label = `今天 ${md}` }
    else if (diff === 1) { tone = 'info'; label = `明天 ${md}` }
  }
  return (
    <Tag tone={tone}>
      <CalIcon size={10} className="mr-0.5" />
      {label}
    </Tag>
  )
}

function ViewTab({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap',
        active ? 'bg-ink-700 text-paper-50' : 'text-soft hover:bg-ink-100',
      )}
    >
      {icon}
      {label}
      <span className={cn('text-xs px-1 rounded', active ? 'bg-ink-600' : 'bg-ink-100')}>{count}</span>
    </button>
  )
}

/* ============================================================
 * 新建 / 编辑 弹窗
 * ============================================================ */

interface TaskFormProps {
  open: boolean
  defaultMyDay: boolean
  onClose: () => void
  initial: Task | null
  classes: ClassEntity[]
  onSaved: () => void
}

function TaskFormModal({ open, defaultMyDay, onClose, initial, classes, onSaved }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [dueDate, setDueDate] = useState('')
  const [classId, setClassId] = useState('')
  const [tags, setTags] = useState('')
  const [starred, setStarred] = useState(false)
  const [myDay, setMyDay] = useState(false)
  const [subtasks, setSubtasks] = useState<SubTask[]>([])
  const [subInput, setSubInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setTitle(initial.title)
      setContent(initial.content ?? '')
      setPriority(initial.priority)
      setDueDate(initial.dueDate ?? '')
      setClassId(initial.classId ?? '')
      setTags((initial.tags || []).join('、'))
      setStarred(!!initial.starred)
      setMyDay(!!initial.myDay)
      setSubtasks(initial.subtasks ?? [])
    } else {
      setTitle(''); setContent(''); setPriority('medium'); setDueDate(''); setClassId(''); setTags('')
      setStarred(false); setMyDay(defaultMyDay); setSubtasks([])
    }
    setSubInput('')
  }, [open, initial, defaultMyDay])

  function addSub() {
    const v = subInput.trim()
    if (!v) return
    setSubtasks((prev) => [...prev, { id: uid('st'), title: v, done: false }])
    setSubInput('')
  }

  function removeSub(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
  }

  function toggleSubDone(id: string) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)))
  }

  async function save() {
    if (!title.trim()) { toast.warn('请输入标题'); return }
    setSaving(true)
    try {
      const data = {
        title: title.trim(),
        content: content.trim(),
        priority,
        dueDate: dueDate || null,
        classId: classId || null,
        tags: tags.split(/[、,，]/).map((x) => x.trim()).filter(Boolean),
        starred,
        myDay,
        subtasks,
        done: initial?.done ?? false,
        doneAt: initial?.doneAt ?? null,
      } as Partial<Task>
      if (initial) await taskRepo.update(initial.id, data)
      else await taskRepo.create(data as any)
      toast.success(initial ? '已保存' : '已添加')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const doneSub = subtasks.filter((s) => s.done).length

  return (
    <Modal open={open} onClose={onClose} title={initial ? '编辑待办' : '新建待办'} size="lg">
      <div className="p-4 space-y-3">
        <FF label="标题" required>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：与张同学家长沟通" />
        </FF>
        <FF label="详情">
          <textarea rows={3} className="input resize-none" value={content} onChange={(e) => setContent(e.target.value)} />
        </FF>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FF label="优先级">
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </FF>
          <FF label="截止日期">
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FF>
          <FF label="关联班级">
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">不关联</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FF>
        </div>

        <FF label="标签">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="用、或者逗号分隔，如：家访、家长会" />
        </FF>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} className="accent-amber-500" />
            <Star size={14} className={starred ? 'text-amber-500 fill-amber-400' : 'text-muted-400'} /> 重要（标星）
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={myDay} onChange={(e) => setMyDay(e.target.checked)} className="accent-amber-500" />
            <Sun size={14} className={myDay ? 'text-amber-500 fill-amber-400' : 'text-muted-400'} /> 加入我的一天
          </label>
        </div>

        {/* 子任务 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-soft">子任务清单</span>
            {subtasks.length > 0 && <span className="text-xs text-soft">{doneSub}/{subtasks.length}</span>}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input"
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }}
              placeholder="添加子任务，回车确认"
            />
            <Button variant="outline" size="sm" onClick={addSub}><Plus size={14} /></Button>
          </div>
          {subtasks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleSubDone(s.id)}
                    className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', s.done ? 'bg-ink-700 border-ink-700 text-paper-50' : 'border-ink-300 hover:border-ink-500')}
                  >
                    {s.done && <Check size={10} />}
                  </button>
                  <input
                    className="flex-1 bg-transparent text-sm py-1 border-b border-transparent focus:border-ink-200 focus:outline-none"
                    value={s.title}
                    onChange={(e) => setSubtasks((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                  />
                  <button onClick={() => removeSub(s.id)} className="text-muted-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => void save()} loading={saving}>{initial ? '保存' : '添加'}</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ============================================================
 * 工具函数
 * ============================================================ */

function FF({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <div className="text-xs text-soft mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {children}
    </div>
  )
}

const PRI_WEIGHT: Record<Task['priority'], number> = { high: 3, medium: 2, low: 1 }

function sortManual(list: Task[]): Task[] {
  return list.slice().sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER
    const ob = b.order ?? Number.MAX_SAFE_INTEGER
    if (oa !== ob) return oa - ob
    const sa = a.starred ? 1 : 0
    const sb = b.starred ? 1 : 0
    if (sa !== sb) return sb - sa
    const pa = PRI_WEIGHT[a.priority]
    const pb = PRI_WEIGHT[b.priority]
    if (pa !== pb) return pb - pa
    return (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz')
  })
}

function groupUpcoming(list: Task[]): { key: string; label: string; items: Task[] }[] {
  const buckets: { key: string; label: string; test: (d: Date) => boolean }[] = [
    { key: 'today', label: '今天', test: (d) => diffDays(new Date(), d) === 0 },
    { key: 'tomorrow', label: '明天', test: (d) => diffDays(new Date(), d) === 1 },
    { key: 'week', label: '本周', test: (d) => { const n = diffDays(new Date(), d); return n >= 2 && n <= 7 } },
    { key: 'later', label: '更晚', test: (d) => diffDays(new Date(), d) > 7 },
  ]
  const groups: { key: string; label: string; items: Task[] }[] = []
  for (const b of buckets) {
    const items = list.filter((t) => t.dueDate && b.test(new Date(t.dueDate)))
    if (items.length) groups.push({ key: b.key, label: b.label, items })
  }
  // 落在过去（逾期）的也归入「更晚」之前单独一组
  const overdue = list.filter((t) => t.dueDate && diffDays(new Date(), new Date(t.dueDate)) < 0)
  if (overdue.length) groups.unshift({ key: 'overdue', label: '已逾期', items: overdue })
  return groups
}

function emptyTitle(view: ViewKey): string {
  if (view === 'myday') return '今天还没有规划'
  if (view === 'open') return '没有进行中的待办'
  if (view === 'upcoming') return '近期没有待办'
  return '还没有完成过的事项'
}

function emptyDesc(view: ViewKey): string {
  if (view === 'myday') return '在「进行中」里点击 ☀ 把任务加入今天，或用上方快速录入并选择「我的一天」。'
  if (view === 'open') return '添加待办，让工作有序进行。'
  if (view === 'upcoming') return '给待办设置截止日期后，会在这里按时间分组显示。'
  return '完成的事项会保留在这里。'
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const WEEKDAY: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 }

function parseDateToken(text: string): { match: string; iso: string } | null {
  const today = new Date()
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }
  const fmt = (d: Date) => formatDate(d)

  for (const kw of ['今天', '今日', 'today', 'Today']) if (text.includes(kw)) return { match: kw, iso: fmt(today) }
  for (const kw of ['明天', '明日', 'tmr', 'tomorrow']) if (text.includes(kw)) return { match: kw, iso: fmt(addDays(1)) }
  if (text.includes('后天')) return { match: '后天', iso: fmt(addDays(2)) }

  const wk = text.match(/(?:星期|周)([一二三四五六日天])/)
  if (wk) {
    const target = WEEKDAY[wk[2]]
    const cur = today.getDay() === 0 ? 7 : today.getDay()
    let diff = target - cur
    if (diff <= 0) diff += 7
    return { match: wk[0], iso: fmt(addDays(diff)) }
  }

  const num = text.match(/(\d{1,2})[-./月](\d{1,2})(?:日|号)?/)
  if (num) {
    const mo = +num[1]
    const da = +num[2]
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      const d = new Date(today.getFullYear(), mo - 1, da)
      return { match: num[0], iso: fmt(d) }
    }
  }
  return null
}

/** 智能快速录入解析：#标签 !优先级 日期关键词 */
function parseQuickAdd(raw: string): {
  title: string
  priority: Task['priority']
  dueDate: string | null
  tags: string[]
  starred: boolean
} {
  let text = ` ${raw.trim()} `
  const tags: string[] = []
  text = text.replace(/#([^\s#]+)/gu, (_m, t: string) => { tags.push(t); return ' ' })

  let priority: Task['priority'] = 'medium'
  const priMap: [string, Task['priority']][] = [
    ['!高', 'high'], ['!high', 'high'], ['!h', 'high'], ['高优', 'high'], ['紧急', 'high'],
    ['!中', 'medium'], ['!mid', 'medium'], ['!m', 'medium'], ['中优', 'medium'],
    ['!低', 'low'], ['!low', 'low'], ['!l', 'low'], ['低优', 'low'],
  ]
  for (const [tok, p] of priMap) {
    const re = new RegExp(escapeRegExp(tok))
    if (re.test(text)) { priority = p; text = text.replace(re, ' ') }
  }

  let starred = false
  if (text.includes('!重要') || text.includes('★') || /\s\*(?=\s)/.test(text)) {
    starred = true
    text = text.replace(/!重要/g, ' ').replace(/★/g, ' ').replace(/\s\*(?=\s)/g, ' ')
  }

  let dueDate: string | null = null
  const dateRes = parseDateToken(text)
  if (dateRes) { dueDate = dateRes.iso; text = text.replace(dateRes.match, ' ') }

  const title = text.replace(/\s+/g, ' ').trim()
  return { title, priority, dueDate, tags, starred }
}
