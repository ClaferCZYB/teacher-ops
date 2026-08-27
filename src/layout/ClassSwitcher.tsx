/**
 * 当前班级切换器（顶部 + 移动端紧凑）
 */
import { useEffect, useState } from 'react'
import { ChevronDown, GraduationCap } from 'lucide-react'
import { classRepo } from '@/db/repositories'
import type { ClassEntity } from '@/types/models'
import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/utils/helpers'

export function ClassSwitcher({ compact = false }: { compact?: boolean }) {
  const currentClassId = useUIStore((s) => s.currentClassId)
  const setCurrent = useUIStore((s) => s.setCurrentClassId)
  const [classes, setClasses] = useState<ClassEntity[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const list = await classRepo.listAll()
      setClasses(list.filter((c) => c.status === 'active'))
      if (!currentClassId && list.length) {
        setCurrent(list[0].id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = classes.find((c) => c.id === currentClassId)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className={cn(
          'flex items-center gap-1.5 rounded-md text-sm border transition-colors',
          compact
            ? 'px-2 py-1 bg-white border-ink-200 text-ink-800'
            : 'px-2.5 py-1.5 bg-white border-ink-200 hover:bg-ink-50',
        )}
      >
        <GraduationCap size={compact ? 13 : 14} className="text-soft" />
        <span className="font-medium truncate max-w-[160px]">
          {current ? current.name : '选择班级'}
        </span>
        {current?.isHomeroom && (
          <span className="text-2xs px-1 py-0.5 rounded bg-amber-100 text-amber-700">班主任</span>
        )}
        <ChevronDown size={12} className="text-soft" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={cn(
            'absolute left-0 top-full mt-1 z-20 bg-white border border-ink-200 rounded-md shadow-soft min-w-[200px] py-1',
          )}>
            {classes.length === 0 && (
              <div className="px-3 py-2 text-xs text-soft">暂未创建班级，请到"班级"页新建</div>
            )}
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCurrent(c.id)
                  setOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm hover:bg-ink-50 flex items-center justify-between',
                  currentClassId === c.id && 'bg-ink-50',
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="flex items-center gap-1">
                  {c.isHomeroom && <span className="text-2xs px-1 rounded bg-amber-100 text-amber-700">班主任</span>}
                  <span className="text-2xs text-soft">{c.grade}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
