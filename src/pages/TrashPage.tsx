/**
 * 回收站 — 软删除数据恢复
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { Empty } from '@/components/Empty'
import { Tag } from '@/components/Tag'
import { toast } from '@/store/toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  studentRepo, classRepo, recordRepo, communicationRepo, attendanceRepo, examRepo, gradeRepo,
  assignmentRepo, taskRepo, scheduleRepo, classNoteRepo, reflectionRepo, classAffairRepo,
  behaviorRuleRepo, knowledgePointRepo,
} from '@/db/repositories'
import type { BaseEntity } from '@/types/models'
import { RotateCcw, Trash2, Archive } from 'lucide-react'
import { formatDate } from '@/utils/helpers'

interface Entry {
  store: string
  label: string
  repo: {
    listDeleted(): Promise<BaseEntity[]>
    restore(id: string): Promise<BaseEntity>
    hardDelete(id: string): Promise<void>
  }
}

const ENTRIES: Entry[] = [
  { store: 'students', label: '学生', repo: studentRepo },
  { store: 'classes', label: '班级', repo: classRepo },
  { store: 'records', label: '成长记录', repo: recordRepo },
  { store: 'communications', label: '家校沟通', repo: communicationRepo },
  { store: 'attendance', label: '考勤', repo: attendanceRepo },
  { store: 'exams', label: '考试', repo: examRepo },
  { store: 'grades', label: '成绩', repo: gradeRepo },
  { store: 'assignments', label: '作业', repo: assignmentRepo },
  { store: 'tasks', label: '待办', repo: taskRepo },
  { store: 'schedules', label: '课程', repo: scheduleRepo },
  { store: 'classNotes', label: '课堂记录', repo: classNoteRepo },
  { store: 'reflections', label: '教学反思', repo: reflectionRepo },
  { store: 'classAffairs', label: '班级事务', repo: classAffairRepo },
  { store: 'behaviorRules', label: '评价规则', repo: behaviorRuleRepo },
  { store: 'knowledgePoints', label: '知识点', repo: knowledgePointRepo },
]

export function TrashPage() {
  const [data, setData] = useState<Record<string, BaseEntity[]>>({})
  const [confirmHardDel, setConfirmHardDel] = useState<{ key: string; id: string } | null>(null)

  async function refresh() {
    const out: Record<string, BaseEntity[]> = {}
    for (const e of ENTRIES) {
      out[e.store] = await e.repo.listDeleted()
    }
    setData(out)
  }
  useEffect(() => { void refresh() }, [])

  const total = Object.values(data).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <div>
      <PageHeader title="回收站" description="误删后可以在这里恢复" />

      {total === 0 ? (
        <Empty icon={<Archive size={20} />} title="回收站是空的" description="删除的数据会暂存在这里。" />
      ) : (
        <div className="space-y-4">
          {ENTRIES.map((e) => {
            const list = data[e.store] ?? []
            if (list.length === 0) return null
            return (
              <section key={e.store} className="card">
                <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Tag>{e.label}</Tag></h3>
                  <span className="text-xs text-soft">{list.length} 项</span>
                </div>
                <ul className="divide-y divide-ink-100">
                  {list.map((it) => (
                    <li key={it.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink-900 truncate">{(it as any).name || (it as any).title || (it as any).content?.slice(0, 40) || it.id.slice(0, 12)}</div>
                        <div className="text-2xs text-soft">删除于 {formatDate((it as any).deletedAt)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={async () => {
                          try { await e.repo.restore(it.id); toast.success('已恢复'); void refresh() }
                          catch (err) { toast.error('恢复失败', String(err)) }
                        }}>
                          <RotateCcw size={12} /> 恢复
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmHardDel({ key: e.store, id: it.id })}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmHardDel}
        onClose={() => setConfirmHardDel(null)}
        destructive
        title="永久删除"
        description="该操作不可恢复。"
        confirmText="永久删除"
        onConfirm={async () => {
          if (!confirmHardDel) return
          const e = ENTRIES.find((x) => x.store === confirmHardDel.key)!
          await e.repo.hardDelete(confirmHardDel.id)
          toast.success('已永久删除')
          void refresh()
        }}
      />
    </div>
  )
}
