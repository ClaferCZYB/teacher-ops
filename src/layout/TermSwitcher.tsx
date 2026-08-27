import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { classRepo } from '@/db/repositories'
import { useUIStore } from '@/store/useUIStore'
import { cn } from '@/utils/helpers'

/**
 * 当前学期切换器：根据已有班级的学期列表聚合
 */
export function TermSwitcher({ compact = false }: { compact?: boolean }) {
  const currentTerm = useUIStore((s) => s.currentTerm)
  const setTerm = useUIStore((s) => s.setCurrentTerm)
  const [terms, setTerms] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const cls = await classRepo.listAll()
      const uniq = Array.from(new Set(cls.flatMap((c) => [c.term, c.academicYear]))).filter(Boolean) as string[]
      if (!uniq.length) {
        uniq.push('本学期')
      }
      setTerms(uniq)
      if (!currentTerm) setTerm(uniq[0])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className={cn(
          'flex items-center gap-1 rounded-md text-xs border transition-colors',
          compact
            ? 'px-2 py-0.5 bg-white border-ink-200 text-soft'
            : 'px-2 py-1 bg-white border-ink-200 hover:bg-ink-50 text-soft',
        )}
      >
        <span className="truncate max-w-[120px]">{currentTerm ?? '学期'}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-ink-200 rounded-md shadow-soft min-w-[160px] py-1">
            {terms.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTerm(t)
                  setOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-ink-50',
                  currentTerm === t && 'bg-ink-50 font-medium text-ink-800',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
