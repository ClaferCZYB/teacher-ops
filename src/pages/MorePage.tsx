/**
 * 移动端"更多"页 — 把分散的功能聚合
 */
import { Link } from 'react-router-dom'
import { useUIStore } from '@/store/useUIStore'
import { classRepo } from '@/db/repositories'
import { useEffect, useState } from 'react'
import type { ClassEntity } from '@/types/models'
import {
  ClipboardCheck, Trophy, MessageSquare, ChartBar, ClipboardList,
  FileEdit, Calendar, Layers, GraduationCap, Users, Archive,
  ListTodo, Settings as SettingsIcon, Database, GraduationCap as ClassIcon,
} from 'lucide-react'

const ITEMS: Array<{ to: string; label: string; icon: any; homeroomOnly?: boolean }> = [
  { to: '/classes', label: '班级', icon: Layers },
  { to: '/seating', label: '座位表', icon: Layers },
  { to: '/groups', label: '小组', icon: Layers },
  { to: '/attendance', label: '考勤', icon: ClipboardCheck, homeroomOnly: true },
  { to: '/behavior', label: '日常表现', icon: Trophy, homeroomOnly: true },
  { to: '/class-affairs', label: '班级事务', icon: MessageSquare, homeroomOnly: true },
  { to: '/communications', label: '家校沟通', icon: MessageSquare, homeroomOnly: true },
  { to: '/grades', label: '成绩', icon: ChartBar },
  { to: '/assignments', label: '作业', icon: ClipboardList },
  { to: '/reflections', label: '教学反思', icon: FileEdit },
  { to: '/schedules', label: '课程', icon: Calendar },
  { to: '/trash', label: '回收站', icon: Archive },
  { to: '/settings', label: '设置', icon: SettingsIcon },
]

export function MorePage() {
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const setCurrent = useUIStore((s) => s.setCurrentClassId)

  useEffect(() => {
    void (async () => { setClasses(await classRepo.listAll()) })()
  }, [])

  const homeroom = classes.find((c) => c.isHomeroom && c.status === 'active')

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink-900">更多</h1>

      {classes.length > 0 && (
        <section className="card p-3">
          <h2 className="text-xs text-soft mb-2 px-1">班级</h2>
          <div className="space-y-1">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrent(c.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-ink-50"
              >
                <span className="flex items-center gap-2">
                  <ClassIcon size={14} className="text-soft" />
                  <span className="text-sm">{c.name}</span>
                  {c.isHomeroom && <span className="text-2xs px-1 py-0.5 rounded bg-amber-100 text-amber-700">班主任</span>}
                </span>
                <span className="text-xs text-soft">{c.grade}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card p-3">
        <h2 className="text-xs text-soft mb-2 px-1">常用</h2>
        <div className="grid grid-cols-4 gap-2">
          {ITEMS.filter((i) => !i.homeroomOnly || !!homeroom).map((i) => {
            const Icon = i.icon
            return (
              <Link
                key={i.to}
                to={i.to}
                className="flex flex-col items-center justify-center py-3 rounded-md hover:bg-ink-50"
              >
                <Icon size={20} className="text-ink-700" />
                <span className="text-xs mt-1 text-ink-800">{i.label}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
