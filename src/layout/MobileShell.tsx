/**
 * 移动端布局：顶部 AppBar + 内容 + 底部导航 + Floating 快速记录按钮
 */
import { ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, Users, ListTodo, Plus, MoreHorizontal, Search } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useUIStore } from '@/store/useUIStore'
import { ClassSwitcher } from './ClassSwitcher'
import { TermSwitcher } from './TermSwitcher'

interface MobileShellProps {
  children: ReactNode
}

export function MobileShell({ children }: MobileShellProps) {
  const openQR = useUIStore((s) => s.openQuickRecord)
  const openSearch = useUIStore((s) => s.openSearch)

  return (
    <div className="min-h-full min-h-[100dvh] flex flex-col bg-paper-50">
      <header className="safe-top sticky top-0 z-30 bg-paper-50/90 backdrop-blur border-b border-ink-100">
        <div className="px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ClassSwitcher compact />
            <div className="mt-1">
              <TermSwitcher compact />
            </div>
          </div>
          <button onClick={openSearch} className="w-9 h-9 rounded-md hover:bg-ink-100 flex items-center justify-center text-soft" aria-label="搜索">
            <Search size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-3 py-3 mobile-page-pad">{children}</main>

      {/* 浮动快速记录按钮 */}
      <button
        onClick={openQR}
        className="fixed right-4 bottom-[88px] z-30 w-14 h-14 rounded-full bg-ink-700 hover:bg-ink-800 text-paper-50 shadow-soft flex items-center justify-center safe-bottom"
        aria-label="快速记录"
      >
        <Plus size={22} />
      </button>

      {/* 底部导航 */}
      <MobileBottomNav />
    </div>
  )
}

function MobileBottomNav() {
  const items = [
    { to: '/', label: '首页', icon: Home, end: true },
    { to: '/students', label: '学生', icon: Users },
    { to: '/tasks', label: '待办', icon: ListTodo },
    { to: '/more', label: '更多', icon: MoreHorizontal },
  ]
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-ink-100 grid grid-cols-4 safe-bottom"
    >
      {items.map((it) => {
        const active = it.end
          ? location.pathname === it.to
          : location.pathname.startsWith(it.to)
        const Icon = it.icon
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={cn(
              'flex flex-col items-center justify-center py-2 text-xs',
              active ? 'text-ink-800 font-medium' : 'text-soft',
            )}
          >
            <Icon size={18} />
            <span className="mt-0.5">{it.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
