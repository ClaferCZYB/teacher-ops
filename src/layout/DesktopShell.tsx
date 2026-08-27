/**
 * 桌面端布局：左侧导航 + 顶栏 + 内容
 */
import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Users, Layers, ListTodo, Calendar, ClipboardList,
  Trophy, MessageSquare, ClipboardCheck, ChartBar, FileEdit,
  ChevronLeft, ChevronRight, Search, Bell, Plus, Settings as SettingsIcon,
  CheckSquare, Archive, Palette,
} from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useUIStore } from '@/store/useUIStore'
import { ClassSwitcher } from './ClassSwitcher'
import { TermSwitcher } from './TermSwitcher'
import { cycleTheme, getTheme, THEMES, applyTheme, type ThemeId } from '@/utils/theme'

interface NavItem {
  to: string
  label: string
  icon: import("lucide-react").LucideIcon
  homeroomOnly?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: '工作台', icon: Home },
  { to: '/classes', label: '班级', icon: Layers },
  { to: '/students', label: '学生', icon: Users },
  { to: '/seating', label: '座位', icon: Layers },
  { to: '/groups', label: '小组', icon: Layers },
  { to: '/attendance', label: '考勤', icon: ClipboardCheck, homeroomOnly: true },
  { to: '/behavior', label: '日常表现', icon: Trophy, homeroomOnly: true },
  { to: '/class-affairs', label: '班级事务', icon: MessageSquare, homeroomOnly: true },
  { to: '/communications', label: '家校沟通', icon: MessageSquare, homeroomOnly: true },
  { to: '/grades', label: '成绩', icon: ChartBar },
  { to: '/assignments', label: '作业', icon: ClipboardList },
  { to: '/reflections', label: '教学反思', icon: FileEdit },
  { to: '/schedules', label: '课程', icon: Calendar },
  { to: '/tasks', label: '待办', icon: ListTodo },
  { to: '/trash', label: '回收站', icon: Archive },
  { to: '/settings', label: '设置', icon: SettingsIcon },
]

interface DesktopShellProps {
  children: ReactNode
}

export function DesktopShell({ children }: DesktopShellProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const openSearch = useUIStore((s) => s.openSearch)
  const openQR = useUIStore((s) => s.openQuickRecord)

  return (
    <div className="min-h-full flex bg-paper-50">
      {/* 侧边栏 */}
      <aside
        className={cn(
          'shrink-0 sticky top-0 self-start h-screen border-r border-ink-100 bg-white flex flex-col transition-[width] duration-200',
          collapsed ? 'w-[64px]' : 'w-[224px]',
        )}
      >
        <div className="h-14 flex items-center px-3 border-b border-ink-100">
          <div className="w-8 h-8 rounded-md bg-ink-700 text-paper-50 flex items-center justify-center shrink-0">
            <CheckSquare size={16} />
          </div>
          {!collapsed && (
            <div className="ml-2 min-w-0">
              <div className="text-sm font-semibold text-ink-900">TeacherOps</div>
              <div className="text-2xs text-soft">教师工作操作系统</div>
            </div>
          )}
          <button
            onClick={toggle}
            className="ml-auto p-1 rounded text-soft hover:bg-ink-100"
            aria-label="切换侧边栏"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 hide-scrollbar">
          {NAV.map((n) => (
            <SidebarLink key={n.to} item={n} collapsed={collapsed} />
          ))}
        </nav>

        {!collapsed && (
          <div className="px-3 py-3 border-t border-ink-100 text-2xs text-muted-400">
            v0.1 · 本地优先
          </div>
        )}
      </aside>

      {/* 右侧 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶栏 */}
        <TopBar onSearch={openSearch} onQuickRecord={openQR} />
        {/* 内容 */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-ink-100 text-ink-900 font-medium'
            : 'text-soft hover:bg-ink-50 hover:text-ink-800',
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

function TopBar({ onSearch, onQuickRecord }: { onSearch: () => void; onQuickRecord: () => void }) {
  const navigate = useNavigate()
  const [themeId, setThemeId] = useState(getTheme())

  function handleCycle() {
    const next = cycleTheme()
    setThemeId(next)
  }

  function handlePick(id: ThemeId) {
    applyTheme(id)
    setThemeId(id)
  }

  return (
    <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 bg-paper-50/85 backdrop-blur border-b border-ink-100 flex items-center gap-3">
      <ClassSwitcher />
      <TermSwitcher />
      <div className="hidden md:block flex-1 max-w-xl mx-auto">
        <button
          onClick={onSearch}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-ink-200 hover:bg-ink-50 text-left text-soft text-sm"
        >
          <Search size={14} />
          <span className="flex-1 truncate">搜索学生、班级、记录…</span>
          <kbd className="text-2xs border border-ink-200 rounded px-1.5">⌘K</kbd>
        </button>
      </div>
      <div className="flex-1 md:hidden" />
      <button
        onClick={onQuickRecord}
        className="btn-primary hidden sm:inline-flex"
        title="快速记录（任意页面）"
      >
        <Plus size={14} /> 快速记录
      </button>
      <button
        onClick={() => useUIStore.getState().openSearch()}
        className="md:hidden btn-ghost"
        aria-label="搜索"
      >
        <Search size={16} />
      </button>
      <button
        onClick={() => navigate('/tasks')}
        className="btn-ghost"
        aria-label="通知"
      >
        <Bell size={16} />
      </button>
      {/* 主题切换（点击循环 / 右键下拉） */}
      <div className="relative group">
        <button
          onClick={handleCycle}
          className="btn-ghost"
          aria-label="切换主题"
          title="切换主题"
        >
          <Palette size={16} />
        </button>
        <div className="hidden group-hover:block absolute right-0 top-full mt-1 z-40 bg-white border border-ink-200 rounded-md shadow-soft p-1 min-w-[120px]">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => handlePick(t.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-ink-50',
                themeId === t.id && 'bg-ink-50 font-medium',
              )}
            >
              <span className="w-3 h-3 rounded-full ring-1 ring-ink-200" style={{ background: t.swatch }} />
              <span>{t.label}</span>
              {themeId === t.id && <span className="ml-auto text-2xs text-soft">✓</span>}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={() => navigate('/settings')}
        className="btn-ghost"
        aria-label="设置"
      >
        <SettingsIcon size={16} />
      </button>
    </header>
  )
}
