/**
 * 全局 UI/上下文状态
 * - 不放业务数据（业务数据走 Repository + DB）
 * - 持久化少量设置到 localStorage
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ToastKind = 'success' | 'info' | 'warn' | 'error'
export interface Toast {
  id: string
  kind: ToastKind
  title: string
  detail?: string
  ts: number
}

interface UIState {
  /** 当前班级（每个视图可以临时切换） */
  currentClassId: string | null
  setCurrentClassId: (id: string | null) => void

  /** 当前学期 */
  currentTerm: string | null
  setCurrentTerm: (term: string | null) => void

  /** 侧边栏折叠 */
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  /** 快速记录抽屉 */
  quickRecordOpen: boolean
  openQuickRecord: (...args: any[]) => void
  closeQuickRecord: () => void

  /** 全局搜索 */
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void

  /** Toasts */
  toasts: Toast[]
  pushToast: (t: Omit<Toast, 'id' | 'ts'>) => void
  dismissToast: (id: string) => void

  /** 移动端侧抽屉（用于班级切换等） */
  mobileDrawerOpen: boolean
  setMobileDrawer: (b: boolean) => void
}

const sid = () => Math.random().toString(36).slice(2, 9)

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      currentClassId: null,
      setCurrentClassId: (id) => set({ currentClassId: id }),

      currentTerm: null,
      setCurrentTerm: (term) => set({ currentTerm: term }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      quickRecordOpen: false,
      openQuickRecord: (presets) => {
        set({ quickRecordOpen: true })
        if (presets?.classId) {
          set({ currentClassId: presets.classId })
        }
      },
      closeQuickRecord: () => set({ quickRecordOpen: false }),

      searchOpen: false,
      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false }),

      toasts: [],
      pushToast: (t) => {
        const id = sid()
        const item: Toast = { id, ts: Date.now(), ...t }
        set((s) => ({ toasts: [...s.toasts, item] }))
        setTimeout(() => get().dismissToast(id), 4000)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

      mobileDrawerOpen: false,
      setMobileDrawer: (b) => set({ mobileDrawerOpen: b }),
    }),
    {
      name: 'tops-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentClassId: s.currentClassId,
        currentTerm: s.currentTerm,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    },
  ),
)
